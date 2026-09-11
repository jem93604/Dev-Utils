from pydantic import BaseModel, Field


class MediaResolveRequest(BaseModel):
    url: str = Field(max_length=2000)
    quality: str = Field(default="720", max_length=10)
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
