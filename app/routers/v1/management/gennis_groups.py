from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import GennisGroup
from app.schemas import GennisGroupCreate, GennisGroupUpdate, GennisGroupOut

router = APIRouter(prefix="/gennis-groups", tags=["Gennis Groups"])


@router.get("/", response_model=List[GennisGroupOut])
def list_groups(
    location_id: Optional[int] = Query(None),
    subject_id: Optional[int] = Query(None),
    teacher_mgmt_id: Optional[int] = Query(None),
    status: Optional[bool] = Query(None),
    deleted: bool = Query(False),
    db: Session = Depends(get_db),
):
    q = db.query(GennisGroup).filter(GennisGroup.deleted == deleted)
    if location_id is not None:
        q = q.filter(GennisGroup.location_id == location_id)
    if subject_id is not None:
        q = q.filter(GennisGroup.subject_id == subject_id)
    if teacher_mgmt_id is not None:
        q = q.filter(GennisGroup.teacher_mgmt_id == teacher_mgmt_id)
    if status is not None:
        q = q.filter(GennisGroup.status == status)
    return q.order_by(GennisGroup.name).all()


@router.get("/{group_id}", response_model=GennisGroupOut)
def get_group(group_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisGroup).filter(GennisGroup.id == group_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Group not found")
    return obj


@router.post("/", response_model=GennisGroupOut, status_code=201)
def create_group(data: GennisGroupCreate, db: Session = Depends(get_db)):
    existing = db.query(GennisGroup).filter(GennisGroup.gennis_id == data.gennis_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Group with this gennis_id already exists")
    obj = GennisGroup(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{group_id}", response_model=GennisGroupOut)
def update_group(group_id: int, data: GennisGroupUpdate, db: Session = Depends(get_db)):
    obj = db.query(GennisGroup).filter(GennisGroup.id == group_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Group not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{group_id}", status_code=204)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisGroup).filter(GennisGroup.id == group_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Group not found")
    obj.deleted = True
    db.commit()
