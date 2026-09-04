import uuid
from fastapi import APIRouter, Depends, HTTPException, Query as QParam
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.entities import Query, Section, SectionInput, Input, Note, Pin
from app.schemas.content import QueryCreate, QueryUpdate, QueryOut, InputOut, NoteOut
from app.services.variables import extract_variables

router = APIRouter(tags=["queries"])


def _pinned(db: Session, uid: str, qid) -> bool:
    return db.query(Pin).filter_by(user_id=uid, query_id=qid).first() is not None


def _out(db: Session, uid: str, q: Query) -> QueryOut:
    return QueryOut(id=q.id, section_id=q.section_id, title=q.title,
                    purpose=q.purpose or "", steps=q.steps or "",
                    sql_text=q.sql_text, variables=q.variables or [],
                    pinned=_pinned(db, uid, q.id))


def _sync_inputs(db: Session, section_id, variables: list[str]):
    for v in variables:
        if not db.get(Input, v):
            db.add(Input(key=v, label=v, placeholder=v))
        if not db.query(SectionInput).filter_by(section_id=section_id, input_key=v).first():
            db.add(SectionInput(section_id=section_id, input_key=v))


@router.get("/sections/{section_id}/queries", response_model=list[QueryOut])
def list_queries(section_id: uuid.UUID, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    qs = db.query(Query).filter(Query.section_id == section_id, Query.deleted_at.is_(None)).order_by(Query.sort_order, Query.title).all()
    return [_out(db, uid, q) for q in qs]


@router.get("/queries/{query_id}", response_model=QueryOut)
def get_query(query_id: uuid.UUID, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    q = db.get(Query, query_id)
    if not q or q.deleted_at:
        raise HTTPException(404, "Query not found")
    return _out(db, uid, q)


@router.post("/queries", response_model=QueryOut)
def create_query(payload: QueryCreate, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    sec = db.get(Section, payload.section_id)
    if not sec or sec.deleted_at:
        raise HTTPException(404, "Section not found")
    if not payload.title.strip() or not payload.sql_text.strip():
        raise HTTPException(422, "Title and sql_text required")
    variables = extract_variables(payload.sql_text)
    q = Query(section_id=sec.id, owner_id=uid, title=payload.title.strip(),
              purpose=payload.purpose, steps=payload.steps,
              sql_text=payload.sql_text, variables=variables)
    db.add(q)
    _sync_inputs(db, sec.id, variables)
    db.commit()
    db.refresh(q)
    return _out(db, uid, q)


@router.patch("/queries/{query_id}", response_model=QueryOut)
def update_query(query_id: uuid.UUID, payload: QueryUpdate, db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    q = db.get(Query, query_id)
    if not q or q.deleted_at:
        raise HTTPException(404, "Query not found")
    if payload.section_id is not None:
        sec = db.get(Section, payload.section_id)
        if not sec or sec.deleted_at:
            raise HTTPException(404, "Section not found")
        q.section_id = sec.id
    if payload.title is not None:
        q.title = payload.title.strip()
    if payload.purpose is not None:
        q.purpose = payload.purpose
    if payload.steps is not None:
        q.steps = payload.steps
    if payload.sql_text is not None:
        q.sql_text = payload.sql_text
        q.variables = extract_variables(payload.sql_text)
        _sync_inputs(db, q.section_id, q.variables)
    db.commit()
    db.refresh(q)
    return _out(db, uid, q)


@router.delete("/queries/{query_id}")
def delete_query(query_id: uuid.UUID, db: Session = Depends(get_db)):
    from datetime import datetime, timezone
    q = db.get(Query, query_id)
    if not q or q.deleted_at:
        raise HTTPException(404, "Query not found")
    q.deleted_at = datetime.now(timezone.utc)
    db.query(Pin).filter_by(query_id=q.id).delete()
    db.commit()
    return {"ok": True}


@router.get("/inputs", response_model=list[InputOut])
def list_inputs(db: Session = Depends(get_db)):
    return db.query(Input).order_by(Input.key).all()


@router.get("/search")
def search(q: str = QParam(min_length=1), db: Session = Depends(get_db)):
    uid = get_current_user_id(db)
    like = f"%{q}%"
    secs = db.query(Section).filter(Section.deleted_at.is_(None),
                                    (Section.name.ilike(like)) | (Section.description.ilike(like))).all()
    queries = db.query(Query).filter(
        Query.deleted_at.is_(None),
        (Query.title.ilike(like)) | (Query.purpose.ilike(like)) | (Query.sql_text.ilike(like)),
    ).limit(100).all()
    notes = db.query(Note).filter(
        Note.owner_id == uid,
        (Note.title.ilike(like)) | (Note.content.ilike(like)),
    ).order_by(Note.updated_at.desc()).limit(50).all()
    return {
        "sections": [{"id": str(s.id), "name": s.name, "slug": s.slug} for s in secs],
        "queries": [_out(db, uid, x) for x in queries],
        "notes": [NoteOut.model_validate(n).model_dump(mode="json") for n in notes],
    }
