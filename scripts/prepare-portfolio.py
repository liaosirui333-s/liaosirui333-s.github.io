"""Prepare the mirrored portfolio without requesting hidden media at startup."""
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit, unquote
from html import escape, unescape
from html.parser import HTMLParser
import re
import sys
import json

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'site')
ORIGIN = 'https://rui-portfolio-2026.liaosirui3.chatgpt.site'
MANIFEST=json.loads((ROOT/'media-manifest.json').read_text()) if (ROOT/'media-manifest.json').exists() else {}

def attrs(tag):
    class Parser(HTMLParser):
        def handle_starttag(self, name, attributes):
            self.name, self.attributes = name, dict(attributes)
    p = Parser(); p.feed(tag)
    return p.name, p.attributes

def render(name, values):
    return '<' + name + ''.join(' ' + k + ('' if v is None else '="' + escape(str(v), quote=True) + '"') for k, v in values.items()) + '>'

def link(url):
    parsed = urlsplit(unescape(url))
    if parsed.netloc and parsed.netloc not in {'rui-portfolio-2026.liaosirui3.chatgpt.site', 'liaosirui.online', 'www.liaosirui.online'}:
        return url
    path = parsed.path.rstrip('/')
    if path in {'index2', '/index2', 'index2.html', '/index2.html', 'projects', '/projects', 'design', '/design'}:
        path = '/design/'
    elif 'guestbook' in path:
        path = '/guestbook/'
    elif path in {'', 'index.html', '/index.html'}:
        path = '/'
    else:
        return url
    return urlunsplit(('', '', path, parsed.query, parsed.fragment))

class ProjectBlocks(HTMLParser):
    def __init__(self,html):
        super().__init__();self.html=html;self.depth=0;self.current=None;self.blocks=[]
        self.lines=[0]
        for m in re.finditer('\n',html):self.lines.append(m.end())
    def position(self):
        line,column=self.getpos();return self.lines[line-1]+column
    def handle_starttag(self,tag,attributes):
        a=dict(attributes)
        if tag=='div':
            self.depth+=1
            if 'project' in a.get('class','').split():self.current=(self.position(),self.depth)
    def handle_endtag(self,tag):
        if tag=='div':
            if self.current and self.current[1]==self.depth:
                self.blocks.append((self.current[0],self.position()+len('</div>')));self.current=None
            self.depth-=1

def update_projects(html):
    parser=ProjectBlocks(html);parser.feed(html)
    for start,end in reversed(parser.blocks):
        block=html[start:end]
        if 'connection/c1.png' in block or 'dresscode/ds1.jpg' in block:
            block=re.sub(r'class="([^"]*)"',lambda m:'class="'+m[1]+' project--double"' if 'project--double' not in m[1] else m[0],block,count=1)
        if 'barrier/bb4.jpg' in block:
            block=re.sub(r'<div class="Slides sliding">\s*<img\b[^>]*src=["\'][^"\']*barrier/bb4\.jpg[^"\']*["\'][^>]*>\s*</div>','',block)
            block=re.sub(r'<a\b[^>]*href=["\'][^"\']*barrier\.htm[^"\']*["\'][^>]*>.*?</a>','',block,flags=re.S)
            block=re.sub(r'book,\s*,','book,',block)
        html=html[:start]+block+html[end:]
    if 'id="project-guestbook"' not in html:
        project='''<div class="project" data-tags="web,etc,all">
          <div class="tag"><div class="web"></div><p>web</p></div>
          <div class="slideshow-container" id="project-guestbook"><div class="Slides sliding"><img src="/guestbook-project.svg" alt="Guestbook — floating colored notes and a compact form"></div></div>
          <div class="info"><p class="title">Guestbook<br><br><span class="type">web, interaction design</span></p><p class="description">A small place to leave a note. Scattered, colorful messages on a minimal page, with a private interface to review, edit, and remove notes.</p><p><a href="/guestbook/">leave a note ↗</a></p></div>
        </div>'''
        html=html.replace('<div class="project-list">','<div class="project-list">\n'+project,1)
    return html


def media(match):
    name, a = attrs(match.group())
    if name == 'img':
        source=a.pop('src',a.get('data-src',''))
        info=MANIFEST.get('/'+urlsplit(source).path.lstrip('/'))
        if info and info['kind']=='video':
            a.pop('loading',None);a.pop('decoding',None)
            if 'alt' in a:a['aria-label']=a.pop('alt')
            a.update({'data-src':info['url'],'muted':None,'loop':None,'playsinline':None,'preload':'none'})
            return render('video',a)+'</video>'
        a['data-src']=source
        if info and info['kind']=='image':
            a['data-srcset']=', '.join(item['url']+' '+str(item['width'])+'w' for item in info['srcset'])
            a['sizes']='(max-width:600px) 100vw, 50vw'
            a['width']=info['width'];a['height']=info['height']
        a.update(loading='lazy', decoding='async')
    elif name == 'source':
        if 'src' in a:
            a['data-src'] = a.pop('src')
    elif name == 'video':
        a.pop('autoplay', None)
        a.update(muted=None, loop=None, playsinline=None, preload='none')
        if 'src' in a:
            a['data-src'] = a.pop('src')
    elif name == 'iframe' and 'player.vimeo.com/video/' in (a.get('src') or a.get('data-src') or ''):
        url = urlsplit(a.pop('src', a.get('data-src', '')))
        query = dict(parse_qsl(url.query))
        query.update(autoplay='1', muted='1', loop='1', autopause='0', playsinline='1', dnt='1')
        a['data-src'] = urlunsplit((url.scheme, url.netloc, url.path, urlencode(query), url.fragment))
        a.update({'data-vimeo': '', 'loading': 'lazy', 'allow': 'autoplay; fullscreen; picture-in-picture', 'title': a.get('title', 'Rui — motion design')})
    return render(name, a)

for filename, canonical in [('index.html', '/'), ('index2.html', '/design/')]:
    page = ROOT / filename
    html = page.read_text()
    # Remove the retired Twitter/X sentence from both About panels.
    html = re.sub(r';\s*i have been wanting to write stories so i started that on\s*<a\b[^>]*href=["\']https?://(?:www\.)?(?:x\.com|twitter\.com)/[^"\']*["\'][^>]*>.*?</a>\.', '.', html, flags=re.I | re.S)
    # Cloudflare's injected challenge belongs to the source host, not the mirror.
    html = re.sub(r'<script>\(function\(\)\{function c\(\).*?</script>', '', html, flags=re.S)
    html = re.sub(r'<a\b[^>]*>', lambda m: render('a', {k: link(v) if k == 'href' else v for k, v in attrs(m.group())[1].items()}), html)
    html = re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>', '', html)
    html = html.replace('</head>', '<link rel="canonical" href="https://liaosirui.online' + canonical + '">\n</head>')
    html = re.sub(r'<script\b[^>]*src=["\']https://player.vimeo.com/api/player.js["\'][^>]*></script>', '', html)
    if filename == 'index2.html':
        html = update_projects(html)
        html = re.sub(r'<(?:img|video|source|iframe)\b[^>]*>', media, html)
        html = html.replace('</body>', '<script src="/media.js" defer></script>\n</body>')
        # Reserve space before lazy images arrive, including after project shuffle.
        html = html.replace('</head>', '<style>.slideshow-container{min-height:220px}.Slides.sliding{min-height:180px}img[data-src]{min-height:180px}.Slides.sliding img{max-width:100%}</style>\n</head>')
    else:
        html = re.sub(r'<script type="module" src="wind.js"></script>', '<script>const startWind=()=>import("/wind.js?v=20261115-readable-hint-4").catch(()=>{});if("requestIdleCallback" in window)requestIdleCallback(startWind,{timeout:1600});else setTimeout(startWind,600);</script>', html)
    html = re.sub(r'(src|href)="index\.(js|css)(?:%3F[^" ]*|\?[^" ]*)?"', lambda m: m[1] + '="/index.' + m[2] + '?v=20261114-2"', html)
    # Old platform links resolve to the user's domain when opened in a browser.
    redirect = '<script>if(location.hostname.endsWith("chatgpt.site"))location.replace("https://liaosirui.online' + canonical + '"+location.search+location.hash);</script>'
    html = html.replace('<head>', '<head>\n' + redirect)
    page.write_text(html)

script = ROOT / 'index.js'
js = script.read_text()
marker = '// 找到所有幻灯片中的视频'
if marker in js:
    js = js.split(marker)[0]
# Keep filter counts in sync with visible portfolio projects.
if 'portfolio-counts' not in js:
    js += '''
// portfolio-counts
document.addEventListener('DOMContentLoaded',()=>{document.querySelector('.tagg')?.addEventListener('click',toggleGrid);const projects=[...document.querySelectorAll('.project-list .project:not([hidden])')];document.querySelectorAll('.filter-list .tag').forEach(tag=>{const count=tag.querySelector('sup');if(count&&tag.id!=='all')count.textContent=' '+projects.filter(project=>(project.dataset.tags||'').split(',').includes(tag.id)).length;});});
'''
script.write_text(js)

wind = ROOT / 'wind.js'
if wind.exists():
    js = wind.read_text()
    js = js.replace('line2.geometry = new THREE.BufferGeometry().setFromPoints(newPointsCurve2);', 'line2.geometry.setFromPoints(newPointsCurve2);')
    js = js.replace('line3.geometry = new THREE.BufferGeometry().setFromPoints(newPointsCurve3);', 'line3.geometry.setFromPoints(newPointsCurve3);')
    js = js.replace('function animate() {\n    requestAnimationFrame(animate);', 'let lastWindFrame = 0;\nfunction animate(timestamp = 0) {\n    requestAnimationFrame(animate);\n    if (document.hidden || timestamp - lastWindFrame < 33) return;\n    lastWindFrame = timestamp;')
    wind.write_text(js)

(ROOT / 'design').mkdir(exist_ok=True)
design = (ROOT / 'index2.html').read_text()
if '<base ' not in design:
    design = design.replace('<head>', '<head><base href="/">')
(ROOT / 'design/index.html').write_text(design)
(ROOT / 'projects').mkdir(exist_ok=True)
(ROOT / 'projects/index.html').write_text('<!doctype html><meta charset="utf-8"><title>Rui</title><meta http-equiv="refresh" content="0;url=/design/"><script>location.replace("/design/"+location.search+location.hash)</script><a href="/design/">See Rui’s work</a>')
print('Prepared /design/, canonical navigation, deferred media, and Vimeo playback.')
