from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import GennisLocationSubject, GennisSubject
from app.schemas import GennisLocationSubjectCreate, GennisLocationSubjectOut, GennisSubjectOut

router = APIRouter(prefix="/gennis-location-subjects", tags=["Gennis Location Subjects"])


@router.get("/", response_model=List[GennisLocationSubjectOut])
def list_location_subjects(
    location_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(GennisLocationSubject)
    if location_id is not None:
        q = q.filter(GennisLocationSubject.location_id == location_id)
    return q.order_by(GennisLocationSubject.location_id, GennisLocationSubject.subject_id).all()


@router.get("/by-location/{location_id}", response_model=List[GennisSubjectOut])
def subjects_by_location(location_id: int, db: Session = Depends(get_db)):
    """Return only the subjects marked as important for this location."""
    rows = (
        db.query(GennisSubject)
        .join(GennisLocationSubject, GennisLocationSubject.subject_id == GennisSubject.id)
        .filter(GennisLocationSubject.location_id == location_id)
        .order_by(GennisSubject.name)
        .all()
    )
    return rows


@router.post("/", response_model=GennisLocationSubjectOut, status_code=201)
def add_location_subject(data: GennisLocationSubjectCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(GennisLocationSubject)
        .filter(
            GennisLocationSubject.subject_id == data.subject_id,
            GennisLocationSubject.location_id == data.location_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Subject already added to this location")

    subject = db.query(GennisSubject).filter(GennisSubject.id == data.subject_id).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    obj = GennisLocationSubject(subject_id=data.subject_id, location_id=data.location_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{entry_id}", status_code=204)
def remove_location_subject(entry_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisLocationSubject).filter(GennisLocationSubject.id == entry_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(obj)
    db.commit()
