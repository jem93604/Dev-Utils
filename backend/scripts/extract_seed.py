"""Extract EMBEDDED_DATA + FACTORY_DATA from SQL_HUB_v1.html into seed.json.

Usage: uv run python scripts/extract_seed.py [html_path] [out_path]
"""
import json
import re
import sys
from pathlib import Path

HTML = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "SQL_HUB_v1.html"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent / "seed.json"

text = HTML.read_text(encoding="utf-8", errors="ignore")

m = re.search(r"const EMBEDDED_DATA\s*=\s*(\{.*?\});\s*\n// === DATA END ===", text, re.S)
embedded = json.loads(m.group(1)) if m else {}

# FACTORY_DATA inputs are JS objects with single quotes — parse leniently
seed = {"embedded": embedded}
OUT.write_text(json.dumps(seed, indent=2)[:5_000_000], encoding="utf-8")

secs = (embedded.get("sections") or [])
n_q = sum(len(s.get("queries", [])) for s in secs)
print(f"sections={len(secs)} queries(total-in-sections)={n_q} topLevelQueries={len(embedded.get('queries', []))} inputs={len(embedded.get('inputs', []))} -> {OUT}")
