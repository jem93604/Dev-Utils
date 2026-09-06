from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import Base, engine, ensure_columns
import app.models  # noqa: F401  (register models)
from app.api.v1 import sections, queries, tools, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Alembic handles prod migrations; create_all keeps dev/simple deploys working for V1
    ensure_columns()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sections.router, prefix="/api/v1")
app.include_router(queries.router, prefix="/api/v1")
app.include_router(tools.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")


@app.get("/health")
def health():
    return {"ok": True, "auth_enabled": settings.auth_enabled}
