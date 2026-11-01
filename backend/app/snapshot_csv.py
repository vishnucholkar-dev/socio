"""Create a credential-free, source-preserving relational CSV snapshot.

This deliberately does not load the files into PostgreSQL. Use the generated
validation report to reconcile the source before enabling a one-time import.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any

MONTHS = {name.lower(): i for i, name in enumerate(("January February March April May June July August September October November December").split(), 1)}


def parse_cycle(label: str) -> tuple[int, int]:
    month_match = re.search(r"\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b", label, re.I)
    year_match = re.search(r"\b(20\d{2})\b", label)
    if not month_match or not year_match:
        raise ValueError(f"Unsupported cycle label: {label!r}")
    m = month_match.group(1).lower()
    month = MONTHS.get(m) or next(i for name, i in MONTHS.items() if name.startswith(m))
    return int(year_match.group(1)), month


def write_csv(directory: Path, name: str, headers: list[str], rows: list[dict[str, Any]]) -> None:
    with (directory / name).open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        writer.writerows({h: row.get(h, "") for h in headers} for row in rows)


def export_snapshot(source: Path, output: Path) -> dict[str, Any]:
    raw = source.read_bytes()
    data = json.loads(raw)
    if data.get("apartment_name") != "Rockcliff 'B' Block":
        raise ValueError("Unexpected apartment_name")
    if "users" in data:
        raise ValueError("Refusing to export any credential records")
    output.mkdir(parents=True, exist_ok=True)
    issues: list[dict[str, Any]] = []

    def issue(severity: str, table: str, key: str, field: str, message: str) -> None:
        issues.append({"severity": severity, "table_name": table, "source_key": key, "field_name": field, "message": message})

    flats = sorted(set(int(n) for n in data.get("flats", [])))
    if len(flats) != len(data.get("flats", [])):
        issue("error", "flats", "", "flat_number", "Duplicate flat number")
    flat_rows = [{"flat_number": n, "floor": n // 100, "shaft_number": n % 100} for n in flats]
    write_csv(output, "flats.csv", ["flat_number", "floor", "shaft_number"], flat_rows)

    waters = {parse_cycle(s["sheet_name"]): s for s in data.get("water_statements", [])}
    maints = {parse_cycle(s["sheet_name"]): s for s in data.get("maintenance_statements", [])}
    if len(waters) != len(data.get("water_statements", [])):
        issue("error", "billing_cycles", "", "month", "Duplicate water statement month")
    if len(maints) != len(data.get("maintenance_statements", [])):
        issue("error", "billing_cycles", "", "month", "Duplicate maintenance statement month")

    cycles: dict[tuple[int, int], dict[str, Any]] = {}
    for ym in sorted(set(waters) | set(maints)):
        w, m = waters.get(ym), maints.get(ym)
        key = f"{ym[0]:04d}-{ym[1]:02d}"
        statement = w or m
        cycles[ym] = {"cycle_key": key, "year": ym[0], "month": ym[1],
            "source_water_sheet_name": w.get("sheet_name", "") if w else "",
            "source_maintenance_sheet_name": m.get("sheet_name", "") if m else "",
            "has_water_statement": str(bool(w)).lower(), "has_maintenance_statement": str(bool(m)).lower(),
            "reading_date": (w or {}).get("reading_date") or "", "days": (w or {}).get("days", ""),
            "source_tanker_bill": (w or {}).get("tanker_bill", ""), "source_electricity_bill": (w or {}).get("electricity_bill", ""),
            "source_common_utilization": (w or {}).get("common_utilization", ""), "source_net_electricity": (w or {}).get("net_electricity", ""),
            "source_mandatory_maintenance": (w or {}).get("mandatory_maintenance", ""), "source_total_water_liters": (w or {}).get("total_water_consumption_liters", ""),
            "source_rate_per_liter": (w or {}).get("liter_per_charge", ""), "cash_opening": (m or {}).get("cash_opening", ""),
            "bank_opening": (m or {}).get("bank_opening", ""), "cash_balance": (m or {}).get("cash_balance", ""),
            "bank_balance": (m or {}).get("bank_balance", ""), "total_balance": (m or {}).get("total_balance", ""),
            "source_statement_title": statement.get("title", "")}
        if not w:
            issue("info", "billing_cycles", key, "water_statement", "Maintenance statement exists without a water statement")
        if w and not w.get("reading_date"):
            issue("warning", "billing_cycles", key, "reading_date", "Blank source reading date; no date synthesized")
    ordered = sorted(cycles)
    for (y1, m1), (y2, m2) in zip(ordered, ordered[1:]):
        gap = y2 * 12 + m2 - (y1 * 12 + m1) - 1
        if gap > 0:
            issue("warning", "billing_cycles", f"{y1:04d}-{m1:02d}..{y2:04d}-{m2:02d}", "month", f"{gap} calendar month(s) missing in source")
    cycle_headers = list(next(iter(cycles.values())).keys()) if cycles else ["cycle_key"]
    write_csv(output, "billing_cycles.csv", cycle_headers, list(cycles.values()))

    water_rows = []
    for ym, stmt in waters.items():
        key, seen = f"{ym[0]:04d}-{ym[1]:02d}", set()
        for ix, row in enumerate(stmt.get("flats", []), 1):
            flat = int(row.get("flat"))
            if flat in seen:
                issue("error", "water_readings", f"{key}:{flat}", "flat_number", "Duplicate reading")
            seen.add(flat)
            opening, closing, source_liters = row.get("opening_reading"), row.get("closing_reading"), row.get("liters")
            placeholder = closing in (None, 0, 0.0) or opening is None
            computed = None if opening is None or closing is None or closing < opening else closing - opening
            if closing not in (None, 0, 0.0) and opening is not None and closing < opening:
                issue("error", "water_readings", f"{key}:{flat}", "closing_reading", "Closing meter below opening")
            if computed is not None and source_liters is not None and abs(float(source_liters) - float(computed)) > 0.01:
                issue("warning", "water_readings", f"{key}:{flat}", "liters", f"Source liters {source_liters} differ from meter delta {computed}")
            if placeholder:
                issue("info", "water_readings", f"{key}:{flat}", "reading_status", "Potential unrecorded placeholder; original values retained")
            water_rows.append({"cycle_key": key, "flat_number": flat, "source_row_number": ix,
                "opening_reading": "" if opening is None else opening, "closing_reading": "" if closing is None else closing,
                "source_liters_consumed": "" if source_liters is None else source_liters, "computed_liters": "" if computed is None else computed,
                "reading_status": "unrecorded" if placeholder else "recorded", "avg_per_day": row.get("avg_per_day", ""),
                "source_water_charge": row.get("water_charge", ""), "source_month_maintenance": row.get("actual_amount", ""),
                "source_previous_pending": row.get("previous_pending", ""), "source_total_payable": row.get("total_payable", ""),
                "source_pending_amount": row.get("pending_amount", "")})
        missing = set(flats) - seen
        if missing:
            issue("warning", "water_readings", key, "flat_number", f"{len(missing)} flats missing water row")
    write_csv(output, "water_readings.csv", ["cycle_key", "flat_number", "source_row_number", "opening_reading", "closing_reading", "source_liters_consumed", "computed_liters", "reading_status", "avg_per_day", "source_water_charge", "source_month_maintenance", "source_previous_pending", "source_total_payable", "source_pending_amount"], water_rows)

    collection_rows, expense_rows, inflow_rows = [], [], []
    for ym, stmt in maints.items():
        key, seen = f"{ym[0]:04d}-{ym[1]:02d}", set()
        for ix, row in enumerate(stmt.get("flats", []), 1):
            flat = int(row.get("flat"))
            if flat in seen:
                issue("error", "flat_collections", f"{key}:{flat}", "flat_number", "Duplicate collection")
            seen.add(flat)
            collection_rows.append({"cycle_key": key, "flat_number": flat, "source_row_number": ix, "month_maintenance": row.get("actual", ""),
                "previous_pending": row.get("previous_pending", ""), "total_payable": row.get("total_payable", ""), "paid_amount": row.get("paid", ""),
                "pending_due": row.get("pending", ""), "status": row.get("status", ""), "payment_mode": row.get("mode", ""),
                "payment_date": row.get("payment_date", ""), "notes": row.get("notes", "")})
        if set(flats) - seen:
            issue("warning", "flat_collections", key, "flat_number", f"{len(set(flats)-seen)} flats missing collection row")
        for kind, source_rows, dest in (("expense", stmt.get("expenses", []), expense_rows), ("inflow", stmt.get("inflows", []), inflow_rows)):
            for ix, row in enumerate(source_rows, 1):
                amount = row.get("amount", "")
                if amount in (0, 0.0, "0", "0.0"):
                    issue("warning", f"society_{kind}s", f"{key}:{ix}", "amount", "Zero-value source row retained")
                if not row.get("id"):
                    issue("warning", f"society_{kind}s", f"{key}:{ix}", "source_id", "Missing ID; cycle and source row preserve provenance")
                if not row.get("date"):
                    issue("warning", f"society_{kind}s", f"{key}:{ix}", "date", "Blank source date; no date synthesized")
                dest.append({"cycle_key": key, "source_row_number": ix, "source_id": row.get("id", ""), "description": row.get("description", ""),
                    "amount": amount, "category": row.get("category", ""), "channel": row.get("type", ""), "transaction_date": row.get("date", "")})
    write_csv(output, "flat_collections.csv", ["cycle_key", "flat_number", "source_row_number", "month_maintenance", "previous_pending", "total_payable", "paid_amount", "pending_due", "status", "payment_mode", "payment_date", "notes"], collection_rows)
    txn_headers = ["cycle_key", "source_row_number", "source_id", "description", "amount", "category", "channel", "transaction_date"]
    write_csv(output, "society_expenses.csv", txn_headers, expense_rows)
    write_csv(output, "society_inflows.csv", txn_headers, inflow_rows)

    policies = [{"source_id": p.get("id", ""), "effective_from": p.get("effective_from", ""), "mandatory_maintenance": p.get("mandatory_maintenance", ""),
        "common_utilization": p.get("common_utilization", ""), "changed_at": p.get("changed_at", ""), "changed_by": p.get("changed_by", ""),
        "notes": p.get("notes", ""), "source_row_number": i} for i, p in enumerate(data.get("billing_config_history", []), 1)]
    write_csv(output, "rate_policies.csv", ["source_id", "effective_from", "mandatory_maintenance", "common_utilization", "changed_at", "changed_by", "notes", "source_row_number"], policies)

    vendors, reviews = [], []
    for i, v in enumerate(data.get("contacts", []), 1):
        vendors.append({"source_id": v.get("id", ""), "category": v.get("category", ""), "name": v.get("name", ""), "phone": v.get("phone", ""),
            "alternate_phone": v.get("alternate_phone", ""), "notes": v.get("notes", ""), "available_hours": v.get("available_hours", ""),
            "source_average_rating": v.get("average_rating", ""), "source_total_reviews": v.get("total_reviews", ""), "source_row_number": i})
        for ri, r in enumerate(v.get("reviews", []), 1):
            reviews.append({"vendor_source_id": v.get("id", ""), "source_review_id": r.get("id", ""), "reviewer_flat": r.get("flat", ""),
                "rating": r.get("rating", ""), "comment": r.get("comment", ""), "created_at": r.get("date", ""), "source_row_number": ri})
    write_csv(output, "vendor_directory.csv", ["source_id", "category", "name", "phone", "alternate_phone", "notes", "available_hours", "source_average_rating", "source_total_reviews", "source_row_number"], vendors)
    write_csv(output, "vendor_reviews.csv", ["vendor_source_id", "source_review_id", "reviewer_flat", "rating", "comment", "created_at", "source_row_number"], reviews)
    accounts = [{"legacy_user_id": str(n), "role": "resident", "flat_number": n, "migration_action": "reset_credentials_before_activation"} for n in flats]
    accounts += [{"legacy_user_id": "admin", "role": "admin", "flat_number": "", "migration_action": "create_new_admin_credential"}, {"legacy_user_id": "watchman", "role": "watchman", "flat_number": "", "migration_action": "create_new_watchman_credential"}]
    write_csv(output, "account_migration_checklist.csv", ["legacy_user_id", "role", "flat_number", "migration_action"], accounts)
    write_csv(output, "migration_validation.csv", ["severity", "table_name", "source_key", "field_name", "message"], issues)
    manifest = {"source_file": source.name, "source_sha256": hashlib.sha256(raw).hexdigest(), "exported_at": datetime.now().astimezone().isoformat(),
        "source_rows": {"flats": len(flats), "billing_cycles": len(cycles), "water_readings": len(water_rows), "flat_collections": len(collection_rows),
            "society_expenses": len(expense_rows), "society_inflows": len(inflow_rows), "rate_policies": len(policies), "vendors": len(vendors), "vendor_reviews": len(reviews), "account_migration_checklist": len(accounts)},
        "security": "Credentials omitted; checklist requires new credentials before activation.",
        "issues_by_severity": dict(Counter(r["severity"] for r in issues)), "import_status": "NOT_IMPORTED - reconcile validation issues first"}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
