from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base


class Flat(Base):
    __tablename__ = "flats"
    flat_number: Mapped[int] = mapped_column(Integer, primary_key=True)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    shaft_number: Mapped[int] = mapped_column(Integer, nullable=False)
    owner_name: Mapped[str | None] = mapped_column(String(160))
    phone: Mapped[str | None] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BillingCycle(Base):
    __tablename__ = "billing_cycles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    source_water_sheet_name: Mapped[str | None] = mapped_column(String(120))
    source_maintenance_sheet_name: Mapped[str | None] = mapped_column(String(120))
    has_water_statement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_maintenance_statement: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    reading_date: Mapped[date | None] = mapped_column(Date)
    days: Mapped[int | None] = mapped_column(Integer)
    source_tanker_bill: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_electricity_bill: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_common_utilization: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_net_electricity: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_mandatory_maintenance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_total_water_liters: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_rate_per_liter: Mapped[Decimal | None] = mapped_column(Numeric(12, 6))
    cash_opening: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    bank_opening: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    cash_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    bank_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    total_balance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_statement_title: Mapped[str | None] = mapped_column(String(200))
    source_hash: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (UniqueConstraint("year", "month", name="uq_billing_cycle_year_month"),)


class FlatCollection(Base):
    __tablename__ = "flat_collections"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("billing_cycles.id", ondelete="CASCADE"), nullable=False)
    flat_number: Mapped[int] = mapped_column(ForeignKey("flats.flat_number"), nullable=False)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    month_maintenance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    previous_pending: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    total_payable: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    paid_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    pending_due: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str | None] = mapped_column(String(40))
    payment_mode: Mapped[str | None] = mapped_column(String(40))
    payment_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("cycle_id", "flat_number", name="uq_collection_cycle_flat"),)


class WaterReading(Base):
    __tablename__ = "water_readings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("billing_cycles.id", ondelete="CASCADE"), nullable=False)
    flat_number: Mapped[int] = mapped_column(ForeignKey("flats.flat_number"), nullable=False)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_reading: Mapped[int | None] = mapped_column(Integer)
    closing_reading: Mapped[int | None] = mapped_column(Integer)
    source_liters_consumed: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    computed_liters: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    reading_status: Mapped[str] = mapped_column(String(30), nullable=False)
    avg_per_day: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_water_charge: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_month_maintenance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_previous_pending: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_total_payable: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    source_pending_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    __table_args__ = (UniqueConstraint("cycle_id", "flat_number", name="uq_reading_cycle_flat"),)


class SocietyTransaction(Base):
    __tablename__ = "society_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cycle_id: Mapped[int] = mapped_column(ForeignKey("billing_cycles.id", ondelete="CASCADE"), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_id: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(16, 2))
    category: Mapped[str | None] = mapped_column(String(120))
    channel: Mapped[str | None] = mapped_column(String(40))
    transaction_date: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (UniqueConstraint("cycle_id", "transaction_type", "source_row_number", name="uq_transaction_source_row"),)


class RatePolicy(Base):
    __tablename__ = "rate_policies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    effective_from: Mapped[str] = mapped_column(String(7), nullable=False, unique=True)
    mandatory_maintenance: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    common_utilization: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    changed_by: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str | None] = mapped_column(Text)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)


class Vendor(Base):
    __tablename__ = "vendors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    category: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))
    alternate_phone: Mapped[str | None] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(Text)
    available_hours: Mapped[str | None] = mapped_column(String(160))
    source_average_rating: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    source_total_reviews: Mapped[int | None] = mapped_column(Integer)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)


class VendorReview(Base):
    __tablename__ = "vendor_reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int] = mapped_column(ForeignKey("vendors.id", ondelete="CASCADE"), nullable=False)
    source_review_id: Mapped[str | None] = mapped_column(String(100))
    reviewer_flat: Mapped[int | None] = mapped_column(ForeignKey("flats.flat_number"))
    rating: Mapped[Decimal | None] = mapped_column(Numeric(3, 1))
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[date | None] = mapped_column(Date)
    source_row_number: Mapped[int] = mapped_column(Integer, nullable=False)


class ImportRun(Base):
    __tablename__ = "import_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_sha256: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    row_counts: Mapped[dict | None] = mapped_column(JSON)


class UserAccount(Base):
    __tablename__ = "user_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(30), nullable=False)
    flat_number: Mapped[int | None] = mapped_column(ForeignKey("flats.flat_number"))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    must_reset_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
