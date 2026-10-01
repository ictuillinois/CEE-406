"""Import the instructor's prepared FAA help reference without its standalone UI.

Usage: python scripts/import-faarfield-docs.py path/to/Documentation.html
Requires beautifulsoup4. Images are deduplicated; topic links use BASE_URL at render time.
"""
import base64
import hashlib
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1]
source = BeautifulSoup(Path(sys.argv[1]).read_text(encoding="utf-8"), "html.parser")
assets = root / "public/documentation/faarfield"
assets.mkdir(parents=True, exist_ok=True)
pages = source.select(".section-page")[1:]
ids = {page["id"] for page in pages}
topics = []
group = "Introduction"
for page in pages:
    heading = page.find(re.compile(r"^h[1-6]$"))
    title = re.sub(r"\s+", " ", heading.get_text(" ", strip=True))
    if heading.name == "h1":
        group = title
    heading.decompose()
    for el in page.select(".section-breadcrumb, .section-divider, .doc-related-head, script, object"):
        el.decompose()
    for el in page.find_all(True):
        for attr in list(el.attrs):
            if attr.startswith("on") or attr in ("style", "face", "color", "bgcolor", "width", "height"):
                del el[attr]
        if el.name == "img":
            match = re.fullmatch(r"data:image/(\w+);base64,(.*)", el.get("src", ""), re.S)
            if not match:
                raise ValueError(f"Unresolved image in {page['id']}")
            data = base64.b64decode(match[2])
            ext = {"jpeg": "jpg"}.get(match[1], match[1])
            name = hashlib.sha256(data).hexdigest()[:16] + "." + ext
            (assets / name).write_bytes(data)
            el["src"] = "__BASE__documentation/faarfield/" + name
            el["loading"] = "lazy"
            el["alt"] = el.get("alt") or f"{title}: reference figure"
        if el.name == "a":
            target = el.attrs.pop("data-xref", None)
            if target:
                if target not in ids:
                    raise ValueError(f"Unknown topic: {target}")
                el["href"] = "__BASE__documentation/faarfield/reference/" + target + "/"
            elif el.get("href", "").lower().startswith("javascript:"):
                del el["href"]
    body = "".join(str(child) for child in page.contents).strip()
    topics.append({"id": page["id"], "title": title, "group": group, "html": body})
output = root / "src/data/faarfield-reference.json"
output.write_text(json.dumps(topics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Imported {len(topics)} topics and {len(list(assets.iterdir()))} images.")
