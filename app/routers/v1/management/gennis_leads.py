from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import GennisLead
from app.schemas import GennisLeadCreate, GennisLeadUpdate, GennisLeadOut

router = APIRouter(prefix="/gennis-leads", tags=["Gennis Leads"])


@router.get("/", response_model=List[GennisLeadOut])
def list_leads(
    location_id: Optional[int] = Query(None),
    deleted: bool = Query(False),
    search: Optional[str] = Query(None),
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(GennisLead).filter(GennisLead.deleted == deleted)
    if location_id is not None:
        q = q.filter(GennisLead.location_id == location_id)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            GennisLead.name.ilike(pattern)
            | GennisLead.phone.ilike(pattern)
        )
    return q.order_by(GennisLead.id.desc()).offset(offset).limit(limit).all()


@router.get("/{lead_id}", response_model=GennisLeadOut)
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisLead).filter(GennisLead.id == lead_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lead not found")
    return obj


@router.post("/", response_model=GennisLeadOut, status_code=201)
def create_lead(data: GennisLeadCreate, db: Session = Depends(get_db)):
    existing = db.query(GennisLead).filter(GennisLead.gennis_id == data.gennis_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Lead with this gennis_id already exists")
    obj = GennisLead(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{lead_id}", response_model=GennisLeadOut)
def update_lead(lead_id: int, data: GennisLeadUpdate, db: Session = Depends(get_db)):
    obj = db.query(GennisLead).filter(GennisLead.id == lead_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lead not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{lead_id}", status_code=204)
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    obj = db.query(GennisLead).filter(GennisLead.id == lead_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lead not found")
    obj.deleted = True
    db.commit()
