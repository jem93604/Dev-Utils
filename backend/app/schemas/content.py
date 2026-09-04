import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    color: str = "#f0a500"
    description: str = ""
    inputs: list[str] = []


class SectionUpdate(BaseModel):
    name: str | None = None
    color: str | None = None
    description: str | None = None
    inputs: list[str] | None = None


class SectionOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    color: str
    description: str
    inputs: list[str] = []
    query_count: int = 0

    model_config = {"from_attributes": True}


class QueryCreate(BaseModel):
    section_id: uuid.UUID
    title: str = Field(min_length=1, max_length=300)
    purpose: str = ""
    steps: str = ""
    sql_text: str = Field(min_length=1)


class QueryUpdate(BaseModel):
    section_id: uuid.UUID | None = None
    title: str | None = None
    purpose: str | None = None
    steps: str | None = None
    sql_text: str | None = None


class QueryOut(BaseModel):
    id: uuid.UUID
    section_id: uuid.UUID
    title: str
    purpose: str
    steps: str
    sql_text: str
    variables: list[str] = []
    pinned: bool = False

    model_config = {"from_attributes": True}


class InputOut(BaseModel):
    key: str
    label: str
    placeholder: str = ""

    model_config = {"from_attributes": True}


class NoteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    content: str = ""


class NoteOut(NoteCreate):
    id: uuid.UUID
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ScriptCreate(BaseModel):
    file_name: str = ""
    path: str = ""
    remark: str = ""
    purpose: str = ""
    steps: str = ""


class ScriptOut(ScriptCreate):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class VersionCreate(BaseModel):
    remark: str = "Snapshot"


class VersionOut(BaseModel):
    id: uuid.UUID
    remark: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
