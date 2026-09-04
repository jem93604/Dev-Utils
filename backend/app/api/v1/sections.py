import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.entities import Section, SectionInput, Input, Query
from app.schemas.content import SectionCreate, SectionUpdate, SectionOut
from app.services.variables import slugify

router = APIRouter(prefix="/sections", tags=["sections"])


def _out(s: Section, db: Session) -> SectionOut:
    keys = [r[0] for r in db.query(SectionInput.input_key).filter_by(section_id=s.id).all()]
    qc = db.query(func.count(Query.id)).filter(Query.section_id == s.id, Query.deleted_at.is_(None)).scalar() or 0
    return SectionOut(id=s.id, name=s.name, slug=s.slug, color=s.color,
                      description=s.description or "", inputs=keys, query_count=qc)


@router.get("", response_model=list[SectionOut])
def list_sections(db: Session = Depends(get_db)):
    secs = db.query(Section).filter(Section.deleted_at.is_(None)).order_by(Section.sort_order, Section.name).all()
    return [_out(s, db) for s in secs]


@router.post("", response_model=SectionOut)
def create_section(payload: SectionCreate, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    slug = slugify(payload.name)
    base, i = slug, 2
    while db.query(Section).filter_by(slug=slug).first():
        slug = f"{base}-{i}"
        i += 1
    s = Section(owner_id=uid, name=payload.name.strip(), slug=slug,
                color=payload.color, description=payload.description)
    db.add(s)
    db.flush()
    for k in dict.fromkeys(payload.inputs):
        if not db.get(Input, k):
            db.add(Input(key=k, label=k, placeholder=k))
        db.add(SectionInput(section_id=s.id, input_key=k))
    db.commit()
    db.refresh(s)
    return _out(s, db)


@router.patch("/{section_id}", response_model=SectionOut)
def update_section(section_id: uuid.UUID, payload: SectionUpdate, db: Session = Depends(get_db)):
    s = db.get(Section, section_id)
    if not s or s.deleted_at:
        raise HTTPException(404, "Section not found")
    if payload.name is not None:
        s.name = payload.name.strip()
    if payload.color is not None:
        s.color = payload.color
    if payload.description is not None:
        s.description = payload.description
    if payload.inputs is not None:
        db.query(SectionInput).filter_by(section_id=s.id).delete()
        for k in dict.fromkeys(payload.inputs):
            if not db.get(Input, k):
                db.add(Input(key=k, label=k, placeholder=k))
            db.add(SectionInput(section_id=s.id, input_key=k))
    db.commit()
    db.refresh(s)
    return _out(s, db)


@router.delete("/{section_id}")
def delete_section(section_id: uuid.UUID, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    s = db.get(Section, section_id)
    if not s or s.deleted_at:
        raise HTTPException(404, "Section not found")
    s.deleted_at = datetime.now(timezone.utc)
    db.query(Query).filter(Query.section_id == s.id).update({"deleted_at": s.deleted_at})
    db.commit()
    return {"ok": True}
