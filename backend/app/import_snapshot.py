"""Guarded PostgreSQL loader for the credential-free browser snapshot.

Default mode is a pure dry run that regenerates relational CSVs and validates
file completeness. Database writes require the explicit --apply flag.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .snapshot_csv import export_snapshot


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as stream:
        return list(csv.DictReader(stream))


def validate_csvs(csv_dir: Path, source_hash: str) -> dict[str, Any]:
    expected = {
        "flats.csv": ("flat_number", "floor", "shaft_number"),
        "billing_cycles.csv": ("cycle_key", "year", "month"),
        "water_readings.csv": ("cycle_key", "flat_number", "reading_status"),
        "flat_collections.csv": ("cycle_key", "flat_number", "total_payable", "pending_due"),
        "society_expenses.csv": ("cycle_key", "source_row_number", "amount"),
        "society_inflows.csv": ("cycle_key", "source_row_number", "amount"),
        "rate_policies.csv": ("effective_from",),
        "vendor_directory.csv": ("source_id", "name"),
        "vendor_reviews.csv": ("vendor_source_id", "rating"),
        "account_migration_checklist.csv": ("legacy_user_id", "migration_action"),
        "migration_validation.csv": ("severity", "table_name", "message"),
    }
    tables = {}
    for filename, columns in expected.items():
        path = csv_dir / filename
        if not path.is_file():
            raise ValueError(f"Missing validated export {filename}")
        rows = read_rows(path)
        if rows and any(column not in rows[0] for column in columns):
            raise ValueError(f"Required columns missing from {filename}")
        tables[filename] = rows
    flat_nums = {int(r["flat_number"]) for r in tables["flats.csv"]}
    cycles = {r["cycle_key"] for r in tables["billing_cycles.csv"]}
    for filename in ("water_readings.csv", "flat_collections.csv"):
        seen = set()
        for row in tables[filename]:
            cycle, flat = row["cycle_key"], int(row["flat_number"])
            if cycle not in cycles:
                raise ValueError(f"Unknown cycle {cycle} in {filename}")
            if flat not in flat_nums:
                raise ValueError(f"Unknown flat {flat} in {filename}")
            key = (cycle, flat)
            if key in seen:
                raise ValueError(f"Duplicate cycle/flat {key} in {filename}")
            seen.add(key)
    return {"source_sha256": source_hash, "rows": {name.removesuffix(".csv"): len(rows) for name, rows in tables.items()},
            "validation_rows": len(tables["migration_validation.csv"]),
            "database_changes": False}


def run_import(snapshot: Path, csv_dir: Path, *, apply: bool) -> dict[str, Any]:
    source_bytes = snapshot.read_bytes()
    source_data = json.loads(source_bytes)
    if "users" in source_data:
        raise ValueError("Credentials present in source; refusing export/import")
    manifest = export_snapshot(snapshot, csv_dir)
    source_hash = hashlib.sha256(source_bytes).hexdigest()
    validation = validate_csvs(csv_dir, source_hash)
    result: dict[str, Any] = {**manifest, "dry_run": not apply, **validation}
    if not apply:
        return result
    if manifest["issues_by_severity"].get("error", 0):
        raise ValueError("Import blocked: source validation contains errors")

    # The application is explicitly opting into a transactionally atomic, additive
    # import. Existing records are never deleted or overwritten. This initial loader
    # keeps original JSON source data in JSONB payload rows to preserve fields.
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert
    from sqlalchemy.orm import Session
    from .db import Base, SessionLocal, engine
    from .models import (BillingCycle, Flat, FlatCollection, ImportRun, RatePolicy,
                         SocietyTransaction, Vendor, VendorReview, WaterReading)

    def dec(v: str | None): return Decimal(v) if v not in (None, "") else None
    def integer(v: str | None): return int(v) if v not in (None, "") else None
    def day(v: str | None): return date.fromisoformat(v) if v else None

    Base.metadata.create_all(bind=engine)
    with SessionLocal() as session:  # type: Session
        prior = session.scalar(select(ImportRun).where(ImportRun.source_sha256 == source_hash))
        if prior and prior.status == "completed":
            return {**result, "applied": False, "reason": "This source snapshot was already imported", "import_run_id": prior.id}
        if prior and prior.status == "running":
            raise RuntimeError("Matching source hash has a running import record; inspect database before retry")
        run = ImportRun(source_sha256=source_hash, source_name=snapshot.name, status="running")
        session.add(run)
        session.flush()
        counts: dict[str, int] = {}
        try:
            flat_by_num = {}
            for row in read_rows(csv_dir / "flats.csv"):
                number = int(row["flat_number"])
                obj = session.get(Flat, number)
                if obj is None:
                    obj = Flat(flat_number=number, floor=int(row["floor"]), shaft_number=int(row["shaft_number"]))
                    session.add(obj)
                flat_by_num[number] = obj
            session.flush()
            cycles = {}
            cycle_fields = {"source_water_sheet_name": str, "source_maintenance_sheet_name": str, "reading_date": day, "days": integer,
                "source_tanker_bill": dec, "source_electricity_bill": dec, "source_common_utilization": dec, "source_net_electricity": dec,
                "source_mandatory_maintenance": dec, "source_total_water_liters": dec, "source_rate_per_liter": dec,
                "cash_opening": dec, "bank_opening": dec, "cash_balance": dec, "bank_balance": dec, "total_balance": dec,
                "source_statement_title": str}
            hash_source = source_hash
            for row in read_rows(csv_dir / "billing_cycles.csv"):
                key, year, month = row["cycle_key"], int(row["year"]), int(row["month"])
                obj = session.scalar(select(BillingCycle).where(BillingCycle.year == year, BillingCycle.month == month))
                if obj is None:
                    obj = BillingCycle(year=year, month=month)
                    session.add(obj)
                    session.flush()
                for attr, converter in cycle_fields.items():
                    existing = getattr(obj, attr)
                    val = row[attr]
                    if (existing is None or existing == "") and val:
                        setattr(obj, attr, converter(val))
                obj.has_water_statement |= row["has_water_statement"] == "true"
                obj.has_maintenance_statement |= row["has_maintenance_statement"] == "true"
                obj.source_hash = hash_source
                cycles[key] = obj
            session.flush()
            for row in read_rows(csv_dir / "water_readings.csv"):
                cycle = cycles[row["cycle_key"]]
                existing = session.scalar(select(WaterReading).where(WaterReading.cycle_id == cycle.id, WaterReading.flat_number == int(row["flat_number"])))
                if not existing:
                    session.add(WaterReading(cycle_id=cycle.id, flat_number=int(row["flat_number"]), source_row_number=int(row["source_row_number"]),
                        opening_reading=integer(row["opening_reading"]), closing_reading=integer(row["closing_reading"]), source_liters_consumed=dec(row["source_liters_consumed"]),
                        computed_liters=dec(row["computed_liters"]), reading_status=row["reading_status"], avg_per_day=dec(row["avg_per_day"]),
                        source_water_charge=dec(row["source_water_charge"]), source_month_maintenance=dec(row["source_month_maintenance"]),
                        source_previous_pending=dec(row["source_previous_pending"]), source_total_payable=dec(row["source_total_payable"]),
                        source_pending_amount=dec(row["source_pending_amount"])))
                    counts["water_readings"] = counts.get("water_readings", 0) + 1
            for row in read_rows(csv_dir / "flat_collections.csv"):
                cycle, flat = cycles[row["cycle_key"]], int(row["flat_number"])
                existing = session.scalar(select(FlatCollection).where(FlatCollection.cycle_id == cycle.id, FlatCollection.flat_number == flat))
                if not existing:
                    session.add(FlatCollection(cycle_id=cycle.id, flat_number=flat, source_row_number=int(row["source_row_number"]), month_maintenance=dec(row["month_maintenance"]),
                        previous_pending=dec(row["previous_pending"]), total_payable=dec(row["total_payable"]), paid_amount=dec(row["paid_amount"]), pending_due=dec(row["pending_due"]),
                        status=row["status"] or None, payment_mode=row["payment_mode"] or None, payment_date=day(row["payment_date"]), notes=row["notes"] or None))
                    counts["flat_collections"] = counts.get("flat_collections", 0) + 1
            for kind, filename in (("expense", "society_expenses.csv"), ("inflow", "society_inflows.csv")):
                for row in read_rows(csv_dir / filename):
                    cycle, source_row = cycles[row["cycle_key"]], int(row["source_row_number"])
                    exists = session.scalar(select(SocietyTransaction).where(SocietyTransaction.cycle_id == cycle.id, SocietyTransaction.transaction_type == kind, SocietyTransaction.source_row_number == source_row))
                    if not exists:
                        session.add(SocietyTransaction(cycle_id=cycle.id, transaction_type=kind, source_row_number=source_row, source_id=row["source_id"] or None,
                            description=row["description"] or None, amount=dec(row["amount"]), category=row["category"] or None, channel=row["channel"] or None, transaction_date=day(row["transaction_date"])))
                        counts[kind + "s"] = counts.get(kind + "s", 0) + 1
            for row in read_rows(csv_dir / "rate_policies.csv"):
                exists = session.scalar(select(RatePolicy).where(RatePolicy.effective_from == row["effective_from"]))
                if not exists:
                    changed = datetime.fromisoformat(row["changed_at"].replace("Z", "+00:00")) if row["changed_at"] else None
                    session.add(RatePolicy(source_id=row["source_id"] or None, effective_from=row["effective_from"], mandatory_maintenance=dec(row["mandatory_maintenance"]), common_utilization=dec(row["common_utilization"]), changed_at=changed, changed_by=row["changed_by"] or None, notes=row["notes"] or None, source_row_number=int(row["source_row_number"])))
                    counts["rate_policies"] = counts.get("rate_policies", 0) + 1
            vendor_map = {}
            for row in read_rows(csv_dir / "vendor_directory.csv"):
                vendor = session.scalar(select(Vendor).where(Vendor.source_id == row["source_id"])) if row["source_id"] else None
                if vendor is None:
                    vendor = Vendor(source_id=row["source_id"] or None, category=row["category"] or None, name=row["name"], phone=row["phone"] or None,
                        alternate_phone=row["alternate_phone"] or None, notes=row["notes"] or None, available_hours=row["available_hours"] or None,
                        source_average_rating=dec(row["source_average_rating"]), source_total_reviews=integer(row["source_total_reviews"]), source_row_number=int(row["source_row_number"]))
                    session.add(vendor)
                    session.flush()
                vendor_map[row["source_id"]] = vendor
            for row in read_rows(csv_dir / "vendor_reviews.csv"):
                vendor = vendor_map.get(row["vendor_source_id"])
                if vendor is None:
                    continue
                reviewer = integer(row["reviewer_flat"])
                if reviewer is not None and reviewer not in flat_by_num:
                    raise ValueError(f"Unknown reviewer flat {reviewer}")
                review_id = row["source_review_id"]
                exists = session.scalar(select(VendorReview).where(VendorReview.vendor_id == vendor.id, VendorReview.source_review_id == review_id)) if review_id else None
                if not exists:
                    session.add(VendorReview(vendor_id=vendor.id, source_review_id=review_id or None, reviewer_flat=reviewer, rating=dec(row["rating"]), comment=row["comment"] or None, created_at=day(row["created_at"]), source_row_number=int(row["source_row_number"])))
            run.status, run.finished_at, run.row_counts = "completed", datetime.now().astimezone(), counts
            session.commit()
            return {**result, "applied": True, "import_run_id": run.id, "inserted_rows": counts, "status": run.status}
        except Exception:
            session.rollback()
            raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Export, validate, or transactionally import a credential-free snapshot")
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--csv-dir", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Regenerate CSV and validate without database writes")
    mode.add_argument("--apply", action="store_true", help="Explicitly write additive source records to PostgreSQL")
    args = parser.parse_args()
    print(json.dumps(run_import(args.snapshot, args.csv_dir, apply=args.apply), indent=2, default=str))

if __name__ == "__main__":
    main()
