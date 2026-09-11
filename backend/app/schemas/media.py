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


class MediaVariant(BaseModel):
    id: str = ""
    label: str = ""
    kind: str = Field(default="video", description="video|audio")
    quality: str = "720"
    audio_only: bool = False
    download_endpoint: str = ""
    available: bool | None = Field(
        default=None, description="True when confirmed from metadata, None when unknown"
    )
    approx_size: int | None = None
    ext: str = "mp4"


class MediaResolveOut(BaseModel):
    platform: str
    title: str = ""
    thumbnail: str = ""
    source: str = Field(description="cobalt|ytdlp")
    download_url: str | None = None
    download_endpoint: str | None = Field(
        default=None, description="Same-origin backend download URL (always present)"
    )
    variants: list[MediaVariant] = Field(
        default_factory=list, description="One backend download link per quality/format"
    )
    duration: int | float | None = None
    formats: list[MediaFormat] = []
