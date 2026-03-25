import re, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC  = os.path.join(BASE, "conicorn", "index.html")
DEST = os.path.join(BASE, "site", "index.html")

with open(SRC, "r", encoding="utf-8") as f:
    html = f.read()

def prefix_attr(m):
    attr  = m.group(1)
    quote = m.group(2)
    path  = m.group(3)
    if path.startswith("http") or path.startswith("/") or path.startswith("#") or path.startswith("data:"):
        return m.group(0)
    return attr + "=" + quote + "/conicorn/" + path + quote

# Fix href= and src= attributes
html = re.sub(r'(href|src)=(["\'])([^"\']+)\2', prefix_attr, html)

# Fix srcset= attributes
def fix_srcset(m):
    parts = m.group(1).split(",")
    fixed = []
    for p in parts:
        p = p.strip()
        if p and not p.startswith("/") and not p.startswith("http"):
            p = "/conicorn/" + p
        fixed.append(p)
    return 'srcset="' + ", ".join(fixed) + '"'

html = re.sub(r'srcset="([^"]+)"', fix_srcset, html)

# Fix 1: Remove inline opacity:1 from preloader so CSS default (opacity:0) applies
# Without this the preloader covers the whole page when Webflow animations don't run
html = html.replace('<div style="opacity:1" class="preloader">', '<div class="preloader">')

# Fix 2: Add w-mod-ix3 to html class so the CSS hiding rule doesn't apply
# html.w-mod-js:not(.w-mod-ix3) hides .button-text, .about-text etc until IX3 fires
html = html.replace('class=" w-mod-js"', 'class=" w-mod-js w-mod-ix3"')
html = html.replace("class=\" w-mod-js\"", "class=\" w-mod-js w-mod-ix3\"")

# Fix 3: Point data-wf-domain to our domain so Webflow JS doesn't reject the page
html = html.replace('data-wf-domain="conicorn.webflow.io"', 'data-wf-domain="soccorsodigitale.app"')

with open(DEST, "w", encoding="utf-8") as f:
    f.write(html)

print("Done: " + str(os.path.getsize(DEST)) + " bytes written to " + DEST)
