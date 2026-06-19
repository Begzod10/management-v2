from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import GennisUserLink, User
from app.schemas import GennisUserLinkCreate, GennisUserLinkOut

router = APIRouter(prefix="/gennis-user-links", tags=["Gennis User Links"])


@router.get("/", response_model=List[GennisUserLinkOut])
def list_links(
    management_user_id: Optional[int] = Query(None),
    location_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(GennisUserLink)
    if management_user_id is not None:
        q = q.filter(GennisUserLink.management_user_id == management_user_id)
    if location_id is not None:
        q = q.filter(GennisUserLink.location_id == location_id)
    return q.order_by(GennisUserLink.id).all()


@router.get("/{link_id}", response_model=GennisUserLinkOut)
def get_link(link_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisUserLink).filter(GennisUserLink.id == link_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Link not found")
    return obj


@router.post("/", response_model=GennisUserLinkOut, status_code=201)
def create_link(data: GennisUserLinkCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == data.management_user_id, User.deleted == False).first()
    if not user:
        raise HTTPException(status_code=404, detail="Management user not found")
    existing = db.query(GennisUserLink).filter(
        GennisUserLink.gennis_user_id == data.gennis_user_id
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="gennis_user_id already linked to another user")
    obj = GennisUserLink(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{link_id}", status_code=204)
def delete_link(link_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisUserLink).filter(GennisUserLink.id == link_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Link not found")
    db.delete(obj)
    db.commit()
