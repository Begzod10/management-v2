from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import GennisStudent
from app.schemas import GennisStudentCreate, GennisStudentUpdate, GennisStudentOut

router = APIRouter(prefix="/gennis-students", tags=["Gennis Students"])


@router.get("/", response_model=List[GennisStudentOut])
def list_students(
    search: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(GennisStudent)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            GennisStudent.name.ilike(pattern)
            | GennisStudent.surname.ilike(pattern)
            | GennisStudent.phone.ilike(pattern)
        )
    total = q.count()
    items = q.order_by(GennisStudent.id).offset(offset).limit(limit).all()
    return items


@router.get("/{student_id}", response_model=GennisStudentOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisStudent).filter(GennisStudent.id == student_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Student not found")
    return obj


@router.post("/", response_model=GennisStudentOut, status_code=201)
def create_student(data: GennisStudentCreate, db: Session = Depends(get_db)):
    existing = db.query(GennisStudent).filter(GennisStudent.gennis_id == data.gennis_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Student with this gennis_id already exists")
    obj = GennisStudent(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{student_id}", response_model=GennisStudentOut)
def update_student(student_id: int, data: GennisStudentUpdate, db: Session = Depends(get_db)):
    obj = db.query(GennisStudent).filter(GennisStudent.id == student_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Student not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{student_id}", status_code=204)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisStudent).filter(GennisStudent.id == student_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(obj)
    db.commit()
