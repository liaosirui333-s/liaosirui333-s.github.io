"""Build responsive, color-managed HD images and compact looping videos."""
from pathlib import Path
from urllib.parse import quote
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageOps
import json, os, re, subprocess, sys

root=Path(sys.argv[1] if len(sys.argv)>1 else 'site')
ffmpeg=os.environ.get('FFMPEG_BIN','ffmpeg')
origin='https://rui-portfolio-2026.liaosirui3.chatgpt.site/'
manifest={}

def url(path):return '/'+quote(path.relative_to(root).as_posix())

def image(path):
    with Image.open(path) as source:
        im=ImageOps.exif_transpose(source)
        if im.mode not in ('RGB','RGBA'):im=im.convert('RGBA' if 'transparency' in source.info else 'RGB')
        profile=source.info.get('icc_profile')
        options={'quality':90,'method':5}
        if profile:options['icc_profile']=profile
        full=Path(str(path)+'.webp')
        im.save(full,'WEBP',**options)
        # Keep the smallest full-resolution file without reducing its dimensions.
        chosen=full if full.stat().st_size<path.stat().st_size else path
        candidates=[]
        for width in (640,1280,1920):
            if width>=im.width:continue
            scaled=im.resize((width,max(1,round(im.height*width/im.width))),Image.Resampling.LANCZOS)
            target=path.with_name(path.name+f'.{width}.webp')
            scaled.save(target,'WEBP',**options)
            candidates.append({'url':url(target),'width':width,'bytes':target.stat().st_size})
        candidates.append({'url':url(chosen),'width':im.width,'bytes':chosen.stat().st_size})
        return url(path),{'kind':'image','url':url(chosen),'width':im.width,'height':im.height,'srcset':candidates,'original_bytes':path.stat().st_size,'bytes':chosen.stat().st_size}

stills=[p for p in root.rglob('*') if p.is_file() and p.suffix.lower() in {'.jpg','.jpeg','.png'}]
with ThreadPoolExecutor(max_workers=2) as pool:
    for key,value in pool.map(image,stills):manifest[key]=value

for path in sorted(root.rglob('*')):
    if not path.is_file() or path.suffix.lower() not in {'.gif','.mp4','.mov'} or path.name.endswith('.optimized.mp4'):continue
    if path.suffix.lower()=='.gif':
        with Image.open(path) as animation:
            # Preserve transparent GIF artwork exactly; MP4 cannot carry alpha.
            if 'transparency' in animation.info or animation.convert('RGBA').getchannel('A').getextrema()[0] < 255:
                continue
    target=path.with_name(path.name+'.optimized.mp4')
    command=[ffmpeg,'-v','error','-nostdin','-y']
    command+=['-i',str(path),'-map','0:v:0','-an','-c:v','libx264','-preset','medium','-crf','18','-threads','2','-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2','-pix_fmt','yuv420p','-movflags','+faststart',str(target)]
    result=subprocess.run(command,stderr=subprocess.PIPE,text=True)
    if result.returncode:
        target.unlink(missing_ok=True)
        print(f'Keeping original media: {path.relative_to(root)} (encoder compatibility)')
        continue
    use=target.stat().st_size<path.stat().st_size or path.suffix.lower()=='.mov'
    if use:manifest[url(path)]={'kind':'video','url':url(target),'original_bytes':path.stat().st_size,'bytes':target.stat().st_size}
    else:target.unlink()

replacements={}
for original,info in manifest.items():
    relative=original.lstrip('/')
    for value in {relative,original,origin+relative}:
        replacements[value]=info['url']
        # Wget may preserve literal spaces in inline CSS or JS strings.
        from urllib.parse import unquote
        replacements[unquote(value)]=info['url']
pattern=re.compile(r'(?<![A-Za-z0-9_./%:-])(?:'+'|'.join(re.escape(key) for key in sorted(replacements,key=len,reverse=True))+r')(?![A-Za-z0-9_./%:-])')
for path in root.rglob('*'):
    if path.is_file() and path.suffix in {'.html','.css','.js'}:
        source=path.read_text();path.write_text(pattern.sub(lambda m:replacements[m.group()],source))
# Look up both original and selected URLs when preparing responsive markup.
lookup={}
for original,info in manifest.items():lookup[original]=info;lookup[info['url']]=info
(root/'media-manifest.json').write_text(json.dumps(lookup))
original=sum(x['original_bytes'] for x in manifest.values());optimized=sum(x['bytes'] for x in manifest.values())
thumbs=sum(x['srcset'][0]['bytes'] for x in manifest.values() if x['kind']=='image')
print(f'{len(stills)} HD images; native pixel dimensions and ICC profiles retained.')
print(f'Media: {original:,} original bytes -> {optimized:,} optimized bytes; smallest responsive image set: {thumbs:,} bytes.')
