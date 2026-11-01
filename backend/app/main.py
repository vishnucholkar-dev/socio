from __future__ import annotations

import os
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from .db import Base, engine, get_session
from . import models
from .schemas import BillingCycleOut, CountsOut, FlatOut, HealthOut

APP_VERSION = "0.1.0"
app = FastAPI(title="Rockcliff 'B' Block API", version=APP_VERSION, description="Initial Docker development API. Data import remains a deliberate audited operation.")


@app.on_event("startup")
def initialize_schema() -> None:
    if os.getenv("AUTO_CREATE_SCHEMA", "true").lower() == "true":
        Base.metadata.create_all(bind=engine)


@app.get("/api/v1/health", response_model=HealthOut)
def health(session: Session = Depends(get_session)) -> HealthOut:
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return HealthOut(status="ok", database="connected", migration_note="Initial schema created; audited CSV import has not been run")


@app.get("/api/v1/flats", response_model=list[FlatOut])
def list_flats(session: Session = Depends(get_session)) -> list[models.Flat]:
    return list(session.scalars(select(models.Flat).order_by(models.Flat.flat_number)))


@app.get("/api/v1/billing-cycles", response_model=list[BillingCycleOut])
def list_billing_cycles(limit: int = Query(100, ge=1, le=500), session: Session = Depends(get_session)) -> list[models.BillingCycle]:
    stmt = select(models.BillingCycle).order_by(models.BillingCycle.year.desc(), models.BillingCycle.month.desc()).limit(limit)
    return list(session.scalars(stmt))


@app.get("/api/v1/admin/data-counts", response_model=CountsOut)
def data_counts(session: Session = Depends(get_session)) -> CountsOut:
    return CountsOut(
        flats=session.scalar(select(func.count()).select_from(models.Flat)) or 0,
        billing_cycles=session.scalar(select(func.count()).select_from(models.BillingCycle)) or 0,
        water_readings=session.scalar(select(func.count()).select_from(models.WaterReading)) or 0,
        flat_collections=session.scalar(select(func.count()).select_from(models.FlatCollection)) or 0,
        transactions=session.scalar(select(func.count()).select_from(models.SocietyTransaction)) or 0,
    )


@app.get("/api/v1/admin/import-status")
def import_status(session: Session = Depends(get_session)) -> dict:
    runs = session.scalars(select(models.ImportRun).order_by(models.ImportRun.id.desc()).limit(10)).all()
    return {"status": "no_import" if not runs else "tracked", "imports": [{"source_name": r.source_name, "status": r.status, "started_at": r.started_at, "finished_at": r.finished_at, "row_counts": r.row_counts} for r in runs]}


@app.get("/api/v1")
def api_root() -> JSONResponse:
    return JSONResponse({"name": "Rockcliff 'B' Block API", "version": APP_VERSION, "docs": "/docs", "health": "/api/v1/health", "data_import": "disabled until source reconciliation and explicit approval"})
