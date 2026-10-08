"""Rebuild vendor/threeui/index.json — ids, labels and descriptions of the visible ThreeUI catalog entries.

Server pages (static params, metadata) read this instead of catalog.tsx, which pulls in client renderers.
Run after re-syncing vendor/threeui:  python3 scripts/threeui_index.py
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
catalog = (ROOT / "vendor/threeui/catalog.tsx").read_text()
body = catalog[catalog.index("export const READY_SHADERS"):]

items = []
# Each catalog entry is `{ ...{ <json object> }, component: CommunityRendererN }`
for match in re.finditer(r"\{ \.\.\.(\{\n.*?\n  \}), component: \w+ \}", body, re.S):
    entry = json.loads(match.group(1))
    if entry.get("variantOf"):
        continue
    items.append({"id": entry["id"], "label": entry["label"], "description": entry["description"]})

out = ROOT / "vendor/threeui/index.json"
out.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n")
print(f"{len(items)} entries → {out.relative_to(ROOT)}")
