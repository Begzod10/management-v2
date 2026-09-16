"""Public marketing website content for the Gennis education center.

Ports the old "gennis" project's public home page (admin.gennis.uz CMS:
home_advantages, home_page/add_news, home_page/gallery,
home_page/get_home_info) onto v2-native tables (see the GennisWebsite*
models in app/models.py and the a1b2c3d4e5f6 migration). That old backend
is being retired; v2.gennis.uz has to serve this content directly so the
real public site (a separate static/marketing frontend, not this admin
panel) can keep working.

GET /home and GET /teachers/{id} are intentionally left off the
get_current_user dependency the rest of this codebase puts on every
router — the public marketing site fetches them straight from the browser
with no login. Every write endpoint stays behind auth, matching the
ADMIN_ROLES convention from gennis/detail.py.

File uploads follow the mission_attachments.py pattern exactly: a create
endpoint accepts text fields only (JSON body), and a separate multipart
`.../{id}/image` (or /photo, /images) endpoint uploads/replaces the file.
DB columns store the relative "uploads/..." path; _file_url() below builds
the full public URL only in API responses.
"""
import os
import uuid
from typing import List, Optional

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    GennisWebsiteAdvantage,
    GennisWebsiteNews,
    GennisWebsiteNewsLink,
    GennisWebsiteGalleryImage,
    GennisWebsiteTeacherProfile,
    GennisWebsiteTeacherResult,
)
from app.schemas_website import (
    WebsiteAdvantageCreate, WebsiteAdvantageUpdate, WebsiteAdvantageOut,
    WebsiteNewsCreate, WebsiteNewsUpdate, WebsiteNewsOut,
    WebsiteNewsLinkIn, WebsiteNewsLinkOut,
    WebsiteGalleryImageCreate, WebsiteGalleryImageOut,
    WebsiteTeacherProfileCreate, WebsiteTeacherProfileUpdate,
    WebsiteTeacherProfileOut, WebsiteTeacherProfileDetailOut,
    WebsiteTeacherResultCreate, WebsiteTeacherResultOut,
    WebsiteHomeOut,
)

router = APIRouter(prefix="/gennis/website", tags=["Gennis Website"])

# Same set gennis/detail.py gates its content-management actions with
# (ADMIN_ROLES there covers financial views; this module is public-site
# content, so it's opened up to director too, consistent with how other
# content-authoring routers in this codebase scope mutating access).
ADMIN_ROLES = ("owner", "admin", "director", "manager")

UPLOAD_DIR = "uploads/gennis_website"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _file_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return path
    if path.startswith(("http://", "https://")):
        return path
    return f"{settings.BASE_URL}/{path}"


async def _save_upload(file: UploadFile) -> str:
    ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    return path


def _advantage_out(row: GennisWebsiteAdvantage) -> WebsiteAdvantageOut:
    out = WebsiteAdvantageOut.model_validate(row)
    out.image = _file_url(out.image)
    return out


def _news_out(row: GennisWebsiteNews) -> WebsiteNewsOut:
    out = WebsiteNewsOut.model_validate(row)
    out.image = _file_url(out.image)
    return out


def _gallery_out(row: GennisWebsiteGalleryImage) -> WebsiteGalleryImageOut:
    out = WebsiteGalleryImageOut.model_validate(row)
    out.image = _file_url(out.image)
    return out


def _teacher_out(row: GennisWebsiteTeacherProfile) -> WebsiteTeacherProfileOut:
    out = WebsiteTeacherProfileOut.model_validate(row)
    out.photo = _file_url(out.photo)
    return out


def _teacher_detail_out(row: GennisWebsiteTeacherProfile) -> WebsiteTeacherProfileDetailOut:
    out = WebsiteTeacherProfileDetailOut.model_validate(row)
    out.photo = _file_url(out.photo)
    for r in out.results:
        r.student_photo = _file_url(r.student_photo)
        r.result_image = _file_url(r.result_image)
    return out


def _result_out(row: GennisWebsiteTeacherResult) -> WebsiteTeacherResultOut:
    out = WebsiteTeacherResultOut.model_validate(row)
    out.student_photo = _file_url(out.student_photo)
    out.result_image = _file_url(out.result_image)
    return out


# ── Public ──────────────────────────────────────────────────────────────────

@router.get("/home", response_model=WebsiteHomeOut)
def get_home(db: Session = Depends(get_db)):
    advantages = (
        db.query(GennisWebsiteAdvantage)
        .filter(GennisWebsiteAdvantage.deleted == False)
        .order_by(GennisWebsiteAdvantage.display_order, GennisWebsiteAdvantage.id)
        .all()
    )
    news = (
        db.query(GennisWebsiteNews)
        .options(joinedload(GennisWebsiteNews.links))
        .filter(GennisWebsiteNews.deleted == False)
        .order_by(GennisWebsiteNews.created_at.desc())
        .all()
    )
    gallery = (
        db.query(GennisWebsiteGalleryImage)
        .order_by(GennisWebsiteGalleryImage.slot, GennisWebsiteGalleryImage.id)
        .all()
    )
    teachers = (
        db.query(GennisWebsiteTeacherProfile)
        .filter(GennisWebsiteTeacherProfile.deleted == False)
        .order_by(GennisWebsiteTeacherProfile.display_order, GennisWebsiteTeacherProfile.id)
        .all()
    )
    return WebsiteHomeOut(
        advantages=[_advantage_out(a) for a in advantages],
        news=[_news_out(n) for n in news],
        gallery=[_gallery_out(g) for g in gallery],
        teachers=[_teacher_out(t) for t in teachers],
    )


@router.get("/teachers/{teacher_profile_id}", response_model=WebsiteTeacherProfileDetailOut)
def get_teacher_profile(teacher_profile_id: int, db: Session = Depends(get_db)):
    teacher = (
        db.query(GennisWebsiteTeacherProfile)
        .options(joinedload(GennisWebsiteTeacherProfile.results))
        .filter(
            GennisWebsiteTeacherProfile.id == teacher_profile_id,
            GennisWebsiteTeacherProfile.deleted == False,
        )
        .first()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return _teacher_detail_out(teacher)


# ── Admin: Advantages ────────────────────────────────────────────────────────

@router.get("/advantages", response_model=List[WebsiteAdvantageOut], dependencies=[Depends(get_current_user)])
def list_advantages(include_deleted: bool = False, db: Session = Depends(get_db)):
    q = db.query(GennisWebsiteAdvantage)
    if not include_deleted:
        q = q.filter(GennisWebsiteAdvantage.deleted == False)
    rows = q.order_by(GennisWebsiteAdvantage.display_order, GennisWebsiteAdvantage.id).all()
    return [_advantage_out(r) for r in rows]


@router.post("/advantages", response_model=WebsiteAdvantageOut, status_code=201, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_advantage(payload: WebsiteAdvantageCreate, db: Session = Depends(get_db)):
    row = GennisWebsiteAdvantage(title=payload.title, display_order=payload.display_order or 0)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _advantage_out(row)


def _get_advantage(db: Session, advantage_id: int) -> GennisWebsiteAdvantage:
    row = db.query(GennisWebsiteAdvantage).filter(
        GennisWebsiteAdvantage.id == advantage_id, GennisWebsiteAdvantage.deleted == False
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Advantage not found")
    return row


@router.patch("/advantages/{advantage_id}", response_model=WebsiteAdvantageOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def update_advantage(advantage_id: int, payload: WebsiteAdvantageUpdate, db: Session = Depends(get_db)):
    row = _get_advantage(db, advantage_id)
    if payload.title is not None:
        row.title = payload.title
    if payload.display_order is not None:
        row.display_order = payload.display_order
    db.commit()
    db.refresh(row)
    return _advantage_out(row)


@router.post("/advantages/{advantage_id}/image", response_model=WebsiteAdvantageOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def upload_advantage_image(advantage_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    row = _get_advantage(db, advantage_id)
    row.image = await _save_upload(file)
    db.commit()
    db.refresh(row)
    return _advantage_out(row)


@router.delete("/advantages/{advantage_id}", status_code=204, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def delete_advantage(advantage_id: int, db: Session = Depends(get_db)):
    row = _get_advantage(db, advantage_id)
    row.deleted = True
    db.commit()


# ── Admin: News ──────────────────────────────────────────────────────────────

@router.get("/news", response_model=List[WebsiteNewsOut], dependencies=[Depends(get_current_user)])
def list_news(include_deleted: bool = False, db: Session = Depends(get_db)):
    q = db.query(GennisWebsiteNews).options(joinedload(GennisWebsiteNews.links))
    if not include_deleted:
        q = q.filter(GennisWebsiteNews.deleted == False)
    rows = q.order_by(GennisWebsiteNews.created_at.desc()).all()
    return [_news_out(r) for r in rows]


@router.post("/news", response_model=WebsiteNewsOut, status_code=201, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_news(payload: WebsiteNewsCreate, db: Session = Depends(get_db)):
    row = GennisWebsiteNews(title=payload.title, description=payload.description)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _news_out(row)


def _get_news(db: Session, news_id: int) -> GennisWebsiteNews:
    row = db.query(GennisWebsiteNews).options(joinedload(GennisWebsiteNews.links)).filter(
        GennisWebsiteNews.id == news_id, GennisWebsiteNews.deleted == False
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="News not found")
    return row


@router.patch("/news/{news_id}", response_model=WebsiteNewsOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def update_news(news_id: int, payload: WebsiteNewsUpdate, db: Session = Depends(get_db)):
    row = _get_news(db, news_id)
    if payload.title is not None:
        row.title = payload.title
    if payload.description is not None:
        row.description = payload.description
    db.commit()
    db.refresh(row)
    return _news_out(row)


@router.post("/news/{news_id}/image", response_model=WebsiteNewsOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def upload_news_image(news_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    row = _get_news(db, news_id)
    row.image = await _save_upload(file)
    db.commit()
    db.refresh(row)
    return _news_out(row)


@router.delete("/news/{news_id}", status_code=204, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def delete_news(news_id: int, db: Session = Depends(get_db)):
    row = _get_news(db, news_id)
    row.deleted = True
    db.commit()


@router.put("/news/{news_id}/links", response_model=List[WebsiteNewsLinkOut], dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def replace_news_links(news_id: int, payload: List[WebsiteNewsLinkIn], db: Session = Depends(get_db)):
    """Replaces the full link set in one call — the old gennis news UI never
    had more than a couple of social links per post, so a full-replace PUT
    is simpler than individual add/remove endpoints for that small a set."""
    _get_news(db, news_id)
    db.query(GennisWebsiteNewsLink).filter(GennisWebsiteNewsLink.news_id == news_id).delete()
    rows = [GennisWebsiteNewsLink(news_id=news_id, link_type=l.link_type, url=l.url) for l in payload]
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)
    return [WebsiteNewsLinkOut.model_validate(r) for r in rows]


# ── Admin: Gallery ───────────────────────────────────────────────────────────

@router.get("/gallery", response_model=List[WebsiteGalleryImageOut], dependencies=[Depends(get_current_user)])
def list_gallery(db: Session = Depends(get_db)):
    rows = db.query(GennisWebsiteGalleryImage).order_by(
        GennisWebsiteGalleryImage.slot, GennisWebsiteGalleryImage.id
    ).all()
    return [_gallery_out(r) for r in rows]


@router.post("/gallery", response_model=WebsiteGalleryImageOut, status_code=201, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def create_gallery_image(
    slot: Optional[int] = None,
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    row = GennisWebsiteGalleryImage(slot=slot)
    if file:
        row.image = await _save_upload(file)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _gallery_out(row)


def _get_gallery_image(db: Session, image_id: int) -> GennisWebsiteGalleryImage:
    row = db.query(GennisWebsiteGalleryImage).filter(GennisWebsiteGalleryImage.id == image_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Gallery image not found")
    return row


@router.post("/gallery/{image_id}/image", response_model=WebsiteGalleryImageOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def upload_gallery_image(image_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    row = _get_gallery_image(db, image_id)
    row.image = await _save_upload(file)
    db.commit()
    db.refresh(row)
    return _gallery_out(row)


@router.delete("/gallery/{image_id}", status_code=204, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def delete_gallery_image(image_id: int, db: Session = Depends(get_db)):
    row = _get_gallery_image(db, image_id)
    db.delete(row)
    db.commit()


# ── Admin: Teacher profiles ──────────────────────────────────────────────────

@router.get("/teachers", response_model=List[WebsiteTeacherProfileOut], dependencies=[Depends(get_current_user)])
def list_teacher_profiles(include_deleted: bool = False, db: Session = Depends(get_db)):
    q = db.query(GennisWebsiteTeacherProfile)
    if not include_deleted:
        q = q.filter(GennisWebsiteTeacherProfile.deleted == False)
    rows = q.order_by(GennisWebsiteTeacherProfile.display_order, GennisWebsiteTeacherProfile.id).all()
    return [_teacher_out(r) for r in rows]


@router.post("/teachers", response_model=WebsiteTeacherProfileOut, status_code=201, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_teacher_profile(payload: WebsiteTeacherProfileCreate, db: Session = Depends(get_db)):
    row = GennisWebsiteTeacherProfile(**payload.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _teacher_out(row)


def _get_teacher(db: Session, teacher_id: int) -> GennisWebsiteTeacherProfile:
    row = db.query(GennisWebsiteTeacherProfile).filter(
        GennisWebsiteTeacherProfile.id == teacher_id, GennisWebsiteTeacherProfile.deleted == False
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Teacher profile not found")
    return row


@router.patch("/teachers/{teacher_id}", response_model=WebsiteTeacherProfileOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def update_teacher_profile(teacher_id: int, payload: WebsiteTeacherProfileUpdate, db: Session = Depends(get_db)):
    row = _get_teacher(db, teacher_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return _teacher_out(row)


@router.post("/teachers/{teacher_id}/photo", response_model=WebsiteTeacherProfileOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
async def upload_teacher_photo(teacher_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    row = _get_teacher(db, teacher_id)
    row.photo = await _save_upload(file)
    db.commit()
    db.refresh(row)
    return _teacher_out(row)


@router.delete("/teachers/{teacher_id}", status_code=204, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def delete_teacher_profile(teacher_id: int, db: Session = Depends(get_db)):
    row = _get_teacher(db, teacher_id)
    row.deleted = True
    db.commit()


@router.post("/teachers/{teacher_id}/results", response_model=WebsiteTeacherResultOut, status_code=201, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def create_teacher_result(teacher_id: int, payload: WebsiteTeacherResultCreate, db: Session = Depends(get_db)):
    _get_teacher(db, teacher_id)
    row = GennisWebsiteTeacherResult(
        teacher_profile_id=teacher_id,
        comment=payload.comment,
        student_name=payload.student_name,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _result_out(row)


def _get_teacher_result(db: Session, teacher_id: int, result_id: int) -> GennisWebsiteTeacherResult:
    row = db.query(GennisWebsiteTeacherResult).filter(
        GennisWebsiteTeacherResult.id == result_id,
        GennisWebsiteTeacherResult.teacher_profile_id == teacher_id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    return row


@router.post(
    "/teachers/{teacher_id}/results/{result_id}/images",
    response_model=WebsiteTeacherResultOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
async def upload_teacher_result_images(
    teacher_id: int,
    result_id: int,
    student_photo: Optional[UploadFile] = File(None),
    result_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """One endpoint for both optional images (student_photo + result_image)
    rather than two — they're always uploaded together from the same admin
    form for a single result card, so splitting them would just double the
    round trips for no real benefit."""
    row = _get_teacher_result(db, teacher_id, result_id)
    if student_photo:
        row.student_photo = await _save_upload(student_photo)
    if result_image:
        row.result_image = await _save_upload(result_image)
    db.commit()
    db.refresh(row)
    return _result_out(row)


@router.delete("/teachers/{teacher_id}/results/{result_id}", status_code=204, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def delete_teacher_result(teacher_id: int, result_id: int, db: Session = Depends(get_db)):
    row = _get_teacher_result(db, teacher_id, result_id)
    db.delete(row)
    db.commit()
