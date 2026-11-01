from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict


class FlatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    flat_number: int
    floor: int
    shaft_number: int
    owner_name: str | None = None


class BillingCycleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    year: int
    month: int
    source_water_sheet_name: str | None = None
    source_maintenance_sheet_name: str | None = None
    has_water_statement: bool
    has_maintenance_statement: bool
    reading_date: date | None = None
    total_balance: Decimal | None = None


class CountsOut(BaseModel):
    flats: int
    billing_cycles: int
    water_readings: int
    flat_collections: int
    transactions: int


class HealthOut(BaseModel):
    status: str
    database: str
    migration_note: str
