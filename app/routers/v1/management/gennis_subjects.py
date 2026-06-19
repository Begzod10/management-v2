from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import GennisSubject
from app.schemas import GennisSubjectCreate, GennisSubjectUpdate, GennisSubjectOut

router = APIRouter(prefix="/gennis-subjects", tags=["Gennis Subjects"])


@router.get("/", response_model=List[GennisSubjectOut])
def list_subjects(db: Session = Depends(get_db)):
    return db.query(GennisSubject).order_by(GennisSubject.name).all()


@router.get("/{subject_id}", response_model=GennisSubjectOut)
def get_subject(subject_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisSubject).filter(GennisSubject.id == subject_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Subject not found")
    return obj


@router.post("/", response_model=GennisSubjectOut, status_code=201)
def create_subject(data: GennisSubjectCreate, db: Session = Depends(get_db)):
    existing = db.query(GennisSubject).filter(GennisSubject.gennis_id == data.gennis_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Subject with this gennis_id already exists")
    obj = GennisSubject(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{subject_id}", response_model=GennisSubjectOut)
def update_subject(subject_id: int, data: GennisSubjectUpdate, db: Session = Depends(get_db)):
    obj = db.query(GennisSubject).filter(GennisSubject.id == subject_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Subject not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{subject_id}", status_code=204)
def delete_subject(subject_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisSubject).filter(GennisSubject.id == subject_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Subject not found")
    db.delete(obj)
    db.commit()
