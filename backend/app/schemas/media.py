from pydantic import BaseModel, Field


class MediaResolveRequest(BaseModel):
    url: str
    quality: str = "720"
    audio_only: bool = False


class MediaFormat(BaseModel):
    id: str = ""
    quality: str = ""
    ext: str = ""
    url: str | None = None


class MediaResolveOut(BaseModel):
    platform: str
    title: str = ""
    thumbnail: str = ""
    source: str = Field(description="cobalt|ytdlp")
    download_url: str | None = None
    formats: list[MediaFormat] = []
