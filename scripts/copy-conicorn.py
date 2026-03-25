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

with open(DEST, "w", encoding="utf-8") as f:
    f.write(html)

print("Done: " + str(os.path.getsize(DEST)) + " bytes written to " + DEST)
