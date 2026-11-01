from __future__ import annotations

import json
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.snapshot_csv import export_snapshot


def test_export_preserves_coverage_and_never_exports_credentials(tmp_path: Path) -> None:
    source = Path(__file__).resolve().parents[2] / "exports" / "private" / "rockcliff-live-data-no-credentials-2026-11-01.json"
    output = tmp_path / "csv"
    manifest = export_snapshot(source, output)
    assert manifest["source_rows"]["flats"] == 32
    assert manifest["source_rows"]["billing_cycles"] == 32
    assert manifest["source_rows"]["water_readings"] == 736
    assert manifest["source_rows"]["flat_collections"] == 1024
    assert "users.csv" not in {p.name for p in output.iterdir()}
    assert "12345678" not in "".join(p.read_text(encoding="utf-8-sig") for p in output.glob("*.csv"))


def test_snapshot_has_no_plaintext_users() -> None:
    source = Path(__file__).resolve().parents[2] / "exports" / "private" / "rockcliff-live-data-no-credentials-2026-11-01.json"
    assert "users" not in json.loads(source.read_text(encoding="utf-8"))
