import re

html = open("site/index.html", encoding="utf-8").read()

# 1. Check the hiding CSS rule
idx = html.find("w-mod-ix3")
print("=== Hiding CSS ===")
print(html[max(0,idx-20):idx+150])
print()

# 2. Check data-wf attributes
print("=== data-wf attributes ===")
wf = re.findall(r'data-wf-[\w-]+=.[^"\'> ]+', html[:500])
for w in wf:
    print(" ", w)
print()

# 3. Check if there is embedded IX3 JSON data in HTML
print("=== Webflow IX3 inline data ===")
scripts_wf = re.findall(r'<script[^>]*type="application/json"[^>]*>(.*?)</script>', html, re.DOTALL)
print("JSON script tags:", len(scripts_wf))
for s in scripts_wf[:2]:
    print(" ", s[:200])
print()

# 4. Check webflow JS filenames
print("=== Webflow JS files ===")
wf_js = re.findall(r'/conicorn/js/[^"]+', html)
for j in wf_js:
    print(" ", j)
print()

# 5. Check if external webflow CDN calls exist
print("=== External CDN references ===")
ext = re.findall(r'https://[^"\']+webflow[^"\']+', html)
for e in ext[:10]:
    print(" ", e)
print()

# 6. Check size of webflow main JS
import os
for f in os.listdir("conicorn/js"):
    size = os.path.getsize("conicorn/js/" + f)
    print(f"  {f}: {size:,} bytes")
