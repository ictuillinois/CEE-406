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
from bs4.element import NavigableString


numbered_prefix = re.compile(r"^\s*(\d+)([.)])\s+")


def next_element(node):
    """Ignore formatting whitespace, but never cross another content node."""
    for sibling in node.next_siblings:
        if isinstance(sibling, NavigableString):
            if not sibling.strip():
                continue
            return None
        return sibling
    return None


def semantic_numbered_lists(page, soup):
    """Convert consecutive numbered paragraphs without editing their bodies.

    Require at least two items, matching separators, and ascending consecutive
    numbers. Figures, intervening prose, and resets end a run. Keep all inline
    markup and paragraph attributes; only replace the plain-text list prefix
    with native list numbering. Isolated and ambiguous labels stay unchanged.
    """
    lists = items = 0
    for paragraph in list(page.find_all("p")):
        if paragraph.name != "p" or paragraph.find_parent(["ol", "ul"]):
            continue
        match = numbered_prefix.match(paragraph.get_text())
        if not match:
            continue
        run = [(paragraph, match)]
        following = next_element(paragraph)
        while following is not None and following.name == "p":
            prefix = numbered_prefix.match(following.get_text())
            if (not prefix or prefix[2] != match[2]
                    or int(prefix[1]) != int(match[1]) + len(run)):
                break
            run.append((following, prefix))
            following = next_element(following)
        if len(run) < 2:
            continue
        ordered = soup.new_tag("ol", attrs={"class": "reference-list"})
        if int(match[1]) != 1:
            ordered["start"] = str(int(match[1]))
        paragraph.insert_before(ordered)
        for item, prefix in run:
            remaining = prefix.end()
            for text in list(item.find_all(string=True)):
                if not remaining:
                    break
                removed = min(remaining, len(text))
                text.replace_with(str(text)[removed:])
                remaining -= removed
            item.name = "li"
            ordered.append(item.extract())
        lists += 1
        items += len(run)
    return lists, items

root = Path(__file__).resolve().parents[1]
source = BeautifulSoup(Path(sys.argv[1]).read_text(encoding="utf-8"), "html.parser")
assets = root / "public/documentation/faarfield"
assets.mkdir(parents=True, exist_ok=True)
pages = source.select(".section-page")[1:]
ids = {page["id"] for page in pages}
topics = []
group = "Introduction"
list_count = item_count = 0
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
    lists, items = semantic_numbered_lists(page, source)
    list_count += lists
    item_count += items
    body = "".join(str(child) for child in page.contents).strip()
    topics.append({"id": page["id"], "title": title, "group": group, "html": body})
output = root / "src/data/faarfield-reference.json"
output.write_text(json.dumps(topics, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Imported {len(topics)} topics and {len(list(assets.iterdir()))} images; "
      f"converted {list_count} numbered lists ({item_count} items).")
