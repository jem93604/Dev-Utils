import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.entities import Pin, Query
from app.schemas.content import (
    NoteCreate, NoteOut, ScriptCreate, ScriptOut, VersionCreate, VersionOut,
)
from app.models.entities import Note, Script, Version, Section, SectionInput, Input

router = APIRouter(tags=["tools"])


# ---- Pins ----
@router.get("/pins")
def list_pins(db: Session = Depends(get_db)):
    from app.api.v1.queries import _out
    uid = get_current_user_id(db)
    pins = db.query(Pin).filter_by(user_id=uid).all()
    out = []
    for p in pins:
        q = db.get(Query, p.query_id)
        if q and not q.deleted_at:
            out.append(_out(db, uid, q))
    return out


@router.put("/pins/{query_id}")
def pin(query_id: uuid.UUID, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    if not db.query(Pin).filter_by(user_id=uid, query_id=query_id).first():
        db.add(Pin(user_id=uid, query_id=query_id))
        db.commit()
    return {"ok": True, "pinned": True}


@router.delete("/pins/{query_id}")
def unpin(query_id: uuid.UUID, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    db.query(Pin).filter_by(user_id=uid, query_id=query_id).delete()
    db.commit()
    return {"ok": True, "pinned": False}


# ---- Notes ----
@router.get("/notes", response_model=list[NoteOut])
def list_notes(db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    return db.query(Note).filter_by(owner_id=uid).order_by(Note.created_at.desc()).all()


@router.post("/notes", response_model=NoteOut)
def create_note(payload: NoteCreate, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    n = Note(owner_id=uid, title=payload.title.strip(), content=payload.content)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(note_id: uuid.UUID, payload: NoteCreate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    n = db.get(Note, note_id)
    if not n:
        raise HTTPException(404, "Note not found")
    n.title, n.content = payload.title.strip(), payload.content
    db.commit()
    db.refresh(n)
    return n


@router.delete("/notes/{note_id}")
def delete_note(note_id: uuid.UUID, db: Session = Depends(get_db)):
    n = db.get(Note, note_id)
    if n:
        db.delete(n)
        db.commit()
    return {"ok": True}


# ---- Scripts ----
@router.get("/scripts", response_model=list[ScriptOut])
def list_scripts(db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    return db.query(Script).filter_by(owner_id=uid).order_by(Script.file_name).all()


@router.post("/scripts", response_model=ScriptOut)
def create_script(payload: ScriptCreate, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    s = Script(owner_id=uid, **payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.patch("/scripts/{script_id}", response_model=ScriptOut)
def update_script(script_id: uuid.UUID, payload: ScriptCreate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    s = db.get(Script, script_id)
    if not s:
        raise HTTPException(404, "Script not found")
    for k, v in payload.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/scripts/{script_id}")
def delete_script(script_id: uuid.UUID, db: Session = Depends(get_db)):
    s = db.get(Script, script_id)
    if s:
        db.delete(s)
        db.commit()
    return {"ok": True}


# ---- Versions ----
def _snapshot(db: Session, uid: str) -> dict:
    secs = db.query(Section).filter(Section.deleted_at.is_(None)).all()
    out_secs = []
    for s in secs:
        keys = [r[0] for r in db.query(SectionInput.input_key).filter_by(section_id=s.id).all()]
        qs = db.query(Query).filter(Query.section_id == s.id, Query.deleted_at.is_(None)).all()
        out_secs.append({
            "id": str(s.id), "name": s.name, "slug": s.slug, "color": s.color,
            "desc": s.description or "", "inputs": keys,
            "queries": [{"id": str(q.id), "title": q.title, "purpose": q.purpose or "",
                         "steps": q.steps or "", "sql": q.sql_text} for q in qs],
        })
    inputs = [{"key": i.key, "label": i.label, "placeholder": i.placeholder} for i in db.query(Input).all()]
    notes = [{"title": n.title, "content": n.content} for n in db.query(Note).filter_by(owner_id=uid).all()]
    scripts = [{"file_name": x.file_name, "path": x.path, "remark": x.remark,
                "purpose": x.purpose, "steps": x.steps} for x in db.query(Script).filter_by(owner_id=uid).all()]
    pins = [str(p.query_id) for p in db.query(Pin).filter_by(user_id=uid).all()]
    return {"sections": out_secs, "inputs": inputs, "notes": notes, "scripts": scripts, "pins": pins}


@router.get("/versions", response_model=list[VersionOut])
def list_versions(db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    return db.query(Version).filter_by(owner_id=uid).order_by(Version.created_at.desc()).limit(50).all()


@router.post("/versions", response_model=VersionOut)
def create_version(payload: VersionCreate, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    v = Version(owner_id=uid, remark=payload.remark or "Snapshot", snapshot=_snapshot(db, uid))
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.post("/versions/{version_id}/restore")
def restore_version(version_id: uuid.UUID, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    uid = get_current_user_id(db)
    v = db.get(Version, version_id)
    if not v:
        raise HTTPException(404, "Version not found")
    # Full restore is destructive; implement as snapshot re-import (Phase 1 minimal):
    # delete current content for user, re-create from snapshot ids are regenerated.
    from app.services.variables import slugify
    db.query(Pin).filter_by(user_id=uid).delete()
    for q in db.query(Query).filter_by(owner_id=uid).all():
        db.delete(q)
    for s in db.query(Section).filter_by(owner_id=uid).all():
        db.delete(s)
    db.flush()
    snap = v.snapshot or {}
    for s in snap.get("sections", []):
        sec = Section(owner_id=uid, name=s["name"], slug=slugify(s["name"]) + "-" + s["id"][:8],
                      color=s.get("color", "#f0a500"), description=s.get("desc", ""))
        db.add(sec)
        db.flush()
        for k in s.get("inputs", []):
            if not db.get(Input, k):
                db.add(Input(key=k, label=k, placeholder=k))
            db.add(SectionInput(section_id=sec.id, input_key=k))
        for q in s.get("queries", []):
            from app.services.variables import extract_variables
            db.add(Query(section_id=sec.id, owner_id=uid, title=q["title"],
                         purpose=q.get("purpose", ""), steps=q.get("steps", ""),
                         sql_text=q.get("sql", ""), variables=extract_variables(q.get("sql", ""))))
    db.commit()
    return {"ok": True}


@router.get("/export")
def export_all(db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    return _snapshot(db, uid)


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    return {
        "sections": db.query(Section).filter(Section.deleted_at.is_(None)).count(),
        "queries": db.query(Query).filter(Query.deleted_at.is_(None)).count(),
        "pinned": db.query(Pin).filter_by(user_id=uid).count(),
        "notes": db.query(Note).filter_by(owner_id=uid).count(),
        "scripts": db.query(Script).filter_by(owner_id=uid).count(),
    }
