"""Schemas for the /gennis/website public-marketing-site module.

Kept in its own file (mirrors the schemas_stats.py split already used for
the Gennis Detail dashboards) rather than appended to schemas.py, since this
is a self-contained, unrelated feature area.

Out schemas carry image/photo fields already resolved to full URLs by the
router (see _file_url in app/routers/v1/gennis/website.py) — DB rows only
ever store the relative "uploads/..." path, matching the mission_attachments
convention.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


# --- Advantage ---
class WebsiteAdvantageCreate(BaseModel):
    title: str
    display_order: Optional[int] = 0


class WebsiteAdvantageUpdate(BaseModel):
    title: Optional[str] = None
    display_order: Optional[int] = None


class WebsiteAdvantageOut(BaseModel):
    id: int
    title: str
    image: Optional[str] = None
    display_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted: bool = False

    model_config = {"from_attributes": True}


# --- News ---
class WebsiteNewsLinkIn(BaseModel):
    link_type: str
    url: str


class WebsiteNewsLinkOut(BaseModel):
    id: int
    news_id: int
    link_type: str
    url: str

    model_config = {"from_attributes": True}


class WebsiteNewsCreate(BaseModel):
    title: str
    description: str


class WebsiteNewsUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class WebsiteNewsOut(BaseModel):
    id: int
    title: str
    description: str
    image: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted: bool = False
    links: List[WebsiteNewsLinkOut] = []

    model_config = {"from_attributes": True}


# --- Gallery ---
class WebsiteGalleryImageCreate(BaseModel):
    slot: Optional[int] = None


class WebsiteGalleryImageOut(BaseModel):
    id: int
    image: Optional[str] = None
    slot: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# --- Teacher profile ---
class WebsiteTeacherProfileCreate(BaseModel):
    name: str
    subject_display: Optional[str] = None
    bio: Optional[str] = None
    telegram: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    display_order: Optional[int] = 0
    teacher_user_id: Optional[int] = None
    teacher_gennis_id: Optional[int] = None


class WebsiteTeacherProfileUpdate(BaseModel):
    name: Optional[str] = None
    subject_display: Optional[str] = None
    bio: Optional[str] = None
    telegram: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    display_order: Optional[int] = None
    teacher_user_id: Optional[int] = None
    teacher_gennis_id: Optional[int] = None


class WebsiteTeacherResultCreate(BaseModel):
    comment: Optional[str] = None
    student_name: Optional[str] = None


class WebsiteTeacherResultOut(BaseModel):
    id: int
    teacher_profile_id: int
    comment: Optional[str] = None
    student_photo: Optional[str] = None
    result_image: Optional[str] = None
    student_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class WebsiteTeacherProfileOut(BaseModel):
    id: int
    teacher_user_id: Optional[int] = None
    teacher_gennis_id: Optional[int] = None
    name: str
    subject_display: Optional[str] = None
    photo: Optional[str] = None
    bio: Optional[str] = None
    telegram: Optional[str] = None
    instagram: Optional[str] = None
    facebook: Optional[str] = None
    display_order: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted: bool = False

    model_config = {"from_attributes": True}


class WebsiteTeacherProfileDetailOut(WebsiteTeacherProfileOut):
    results: List[WebsiteTeacherResultOut] = []


# --- Aggregate home payload ---
class WebsiteHomeOut(BaseModel):
    advantages: List[WebsiteAdvantageOut]
    news: List[WebsiteNewsOut]
    gallery: List[WebsiteGalleryImageOut]
    teachers: List[WebsiteTeacherProfileOut]
