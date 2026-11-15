"""Prepare the mirrored portfolio without requesting hidden media at startup."""
from pathlib import Path
from urllib.parse import urlsplit, parse_qsl, urlencode, urlunsplit, unquote
from html import escape, unescape
from html.parser import HTMLParser
import re
import sys

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else 'site')
ORIGIN = 'https://rui-portfolio-2026.liaosirui3.chatgpt.site'

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

def media(match):
    name, a = attrs(match.group())
    if name == 'img':
        if 'src' in a:
            a['data-src'] = a.pop('src')
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
    # Cloudflare's injected challenge belongs to the source host, not the mirror.
    html = re.sub(r'<script>\(function\(\)\{function c\(\).*?</script>', '', html, flags=re.S)
    html = re.sub(r'<a\b[^>]*>', lambda m: render('a', {k: link(v) if k == 'href' else v for k, v in attrs(m.group())[1].items()}), html)
    html = re.sub(r'<link\b[^>]*rel=["\']canonical["\'][^>]*>', '', html)
    html = html.replace('</head>', '<link rel="canonical" href="https://liaosirui.online' + canonical + '">\n</head>')
    html = re.sub(r'<script\b[^>]*src=["\']https://player.vimeo.com/api/player.js["\'][^>]*></script>', '', html)
    if filename == 'index2.html':
        html = re.sub(r'<(?:img|video|source|iframe)\b[^>]*>', media, html)
        html = html.replace('</body>', '<script src="/media.js" defer></script>\n</body>')
        # Reserve space before lazy images arrive, including after project shuffle.
        html = html.replace('</head>', '<style>.slideshow-container{min-height:220px}.Slides.sliding{min-height:180px}img[data-src]{min-height:180px}.Slides.sliding img{max-width:100%}</style>\n</head>')
    else:
        html = re.sub(r'<script type="module" src="wind.js"></script>', '<script>const startWind=()=>import("/wind.js").catch(()=>{});if("requestIdleCallback" in window)requestIdleCallback(startWind,{timeout:1600});else setTimeout(startWind,600);</script>', html)
    html = re.sub(r'(src|href)="index\.(js|css)(?:%3F[^" ]*|\?[^" ]*)?"', lambda m: m[1] + '="/index.' + m[2] + '?v=20261114-1"', html)
    # Old platform links resolve to the user's domain when opened in a browser.
    redirect = '<script>if(location.hostname.endsWith("chatgpt.site"))location.replace("https://liaosirui.online' + canonical + '"+location.search+location.hash);</script>'
    html = html.replace('<head>', '<head>\n' + redirect)
    page.write_text(html)

script = ROOT / 'index.js'
js = script.read_text()
marker = '// 找到所有幻灯片中的视频'
if marker in js:
    js = js.split(marker)[0]
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
