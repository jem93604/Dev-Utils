"""Seed DB from scripts/seed.json (produced by extract_seed.py).

Usage: uv run python scripts/seed_db.py
Respects DATABASE_URL env var.
"""
import json
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base
from app.core.config import settings
from app.models.entities import User, Section, SectionInput, Input, Query, Note, Script
from app.services.variables import extract_variables, slugify

SEED = Path(__file__).resolve().parent / "seed.json"

engine = create_engine(settings.database_url, pool_pre_ping=True)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

data = json.loads(SEED.read_text(encoding="utf-8"))["embedded"]
db = Session()

user = db.query(User).filter_by(email=settings.default_user_email).first()
if not user:
    user = User(email=settings.default_user_email, display_name="Local User")
    db.add(user)
    db.commit()
    db.refresh(user)

if db.query(Section).count():
    print("DB already seeded, skipping")
    raise SystemExit(0)

for i, s in enumerate(data.get("sections", [])):
    sec = Section(owner_id=user.id, name=s["name"], slug=slugify(s["name"]),
                  color=s.get("color", "#f0a500"), description=s.get("desc", ""),
                  sort_order=i)
    db.add(sec)
    db.flush()
    for k in s.get("inputs", []):
        if not db.get(Input, k):
            db.add(Input(key=k, label=k, placeholder=k))
        db.add(SectionInput(section_id=sec.id, input_key=k))

for inp in data.get("inputs", []):
    if isinstance(inp, dict) and inp.get("key") and not db.get(Input, inp["key"]):
        db.add(Input(key=inp["key"], label=inp.get("label", inp["key"]),
                     placeholder=inp.get("placeholder", "")))

# map old section ids (sec-partial...) to new UUIDs by order/name
old_secs = data.get("sections", [])
new_secs = db.query(Section).order_by(Section.sort_order).all()
old_to_new = {o["id"]: n.id for o, n in zip(old_secs, new_secs)}

for i, q in enumerate(data.get("queries", [])):
    sid = old_to_new.get(q.get("sectionId"))
    if not sid:
        continue
    db.add(Query(section_id=sid, owner_id=user.id, title=q.get("title", f"Query {i}"),
                 purpose=q.get("purpose", ""), steps=q.get("steps", ""),
                 sql_text=q.get("sql", ""), variables=extract_variables(q.get("sql", "")),
                 sort_order=i))

for n in data.get("notes", []):
    db.add(Note(owner_id=user.id, title=n.get("title", "Note"), content=n.get("content", "")))

for sc in data.get("scripts", []):
    db.add(Script(owner_id=user.id, file_name=sc.get("name", ""), path=sc.get("path", ""),
                  remark=sc.get("remark", ""), purpose=sc.get("purpose", ""),
                  steps=sc.get("steps", "")))

db.commit()
print(f"Seeded {db.query(Section).count()} sections, {db.query(Query).count()} queries, {db.query(Input).count()} inputs")
