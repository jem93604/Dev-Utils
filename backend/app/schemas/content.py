import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class SectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    color: str = "#f0a500"
    description: str = Field(default="", max_length=5000)
    inputs: list[str] = Field(default_factory=list, max_length=50)


class SectionUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    color: str | None = None
    description: str | None = Field(default=None, max_length=5000)
    inputs: list[str] | None = Field(default=None, max_length=50)


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
    purpose: str = Field(default="", max_length=10000)
    steps: str = Field(default="", max_length=10000)
    sql_text: str = Field(min_length=1, max_length=100000)


class QueryUpdate(BaseModel):
    section_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=300)
    purpose: str | None = Field(default=None, max_length=10000)
    steps: str | None = Field(default=None, max_length=10000)
    sql_text: str | None = Field(default=None, min_length=1, max_length=100000)


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
    content: str = Field(default="", max_length=50000)


class NoteOut(NoteCreate):
    id: uuid.UUID
    sort_order: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReorderNotes(BaseModel):
    """Full custom order: first id gets sort_order 0, next 1, ..."""

    ids: list[uuid.UUID] = Field(max_length=500)


class ScriptCreate(BaseModel):
    file_name: str = Field(default="", max_length=300)
    path: str = Field(default="", max_length=1000)
    remark: str = Field(default="", max_length=1000)
    purpose: str = Field(default="", max_length=10000)
    steps: str = Field(default="", max_length=10000)


class ScriptOut(ScriptCreate):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class VersionCreate(BaseModel):
    remark: str = Field(default="Snapshot", max_length=500)


class VersionOut(BaseModel):
    id: uuid.UUID
    remark: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
