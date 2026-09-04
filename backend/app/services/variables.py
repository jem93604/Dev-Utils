import re
import uuid

VAR_RE = re.compile(r"\{\{\s*([^}\s]+)\s*\}\}")


def extract_variables(sql: str) -> list[str]:
    seen: list[str] = []
    for m in VAR_RE.finditer(sql or ""):
        v = m.group(1).strip()
        if v and v not in seen:
            seen.append(v)
    return seen


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or f"sec-{uuid.uuid4().hex[:8]}"
