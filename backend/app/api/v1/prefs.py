"""Per-user prefs (util order, favorites). Values are lists of strings."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.models.entities import UserPref

router = APIRouter(prefix="/prefs", tags=["prefs"])


class PrefPut(BaseModel):
    value: list[str] = Field(max_length=100)


@router.get("")
def list_prefs(db: Session = Depends(get_db), uid: uuid.UUID = Depends(get_current_user_id)):
    rows = db.query(UserPref).filter_by(user_id=uid).all()
    return {"prefs": {r.key: r.value for r in rows}}


@router.put("/{key}")
def put_pref(key: str, payload: PrefPut, db: Session = Depends(get_db), uid: uuid.UUID = Depends(get_current_user_id)):
    row = db.get(UserPref, {"user_id": uid, "key": key})
    if row:
        row.value = payload.value
    else:
        db.add(UserPref(user_id=uid, key=key, value=payload.value))
    db.commit()
    return {"ok": True, "key": key}
