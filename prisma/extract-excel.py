"""
Extracts historical cash flow data from the Riverdale Academy Excel file
and writes structured JSON for the TypeScript importer to consume.
Run from anywhere:
  python prisma/extract-excel.py
"""

import json, openpyxl
from pathlib import Path

ROOT = Path(__file__).parent.parent
EXCEL = ROOT / "reference_docs" / "updated_riverdale-school-cash-flow.xlsx"
OUT   = ROOT / "prisma" / "historical-data.json"

wb = openpyxl.load_workbook(str(EXCEL), data_only=True)

# ── Helpers ──────────────────────────────────────────────────────────────────

def is_amount(v):
    """True if v is a real positive payment (not None, 'A', '#REF!', 0)."""
    if v is None or v == 'A' or v == '#REF!':
        return False
    try:
        return float(v) > 0
    except (TypeError, ValueError):
        return False

def to_date(year: int, month: int) -> str:
    return f"{year}-{month:02d}-15T00:00:00Z"

# ── 2024-2025 student fees ───────────────────────────────────────────────────
# Sheet: "20242025 Students"
# Columns: StudentName | Jan | Feb | March | April | May | June | July | August
# These map to Jan-Aug 2025 (second semester of 2024-2025 year)

MONTHS_2425 = [
    (2025, 1), (2025, 2), (2025, 3), (2025, 4),
    (2025, 5), (2025, 6), (2025, 7), (2025, 8),
]

ws_2425 = wb["20242025 Students"]
rows_2425 = list(ws_2425.iter_rows(values_only=True))

fee_receipts = []

for row in rows_2425[1:]:  # skip header
    name = row[0]
    if not name or name == "Total Tuition Per Month" or name == "Number on Roll":
        continue
    for col_idx, (yr, mo) in enumerate(MONTHS_2425):
        val = row[col_idx + 1]
        if is_amount(val):
            fee_receipts.append({
                "studentName": str(name).strip(),
                "amount": float(val),
                "date": to_date(yr, mo),
                "academicYear": "2024-2025",
                "paymentMethod": "CASH",
            })

# ── 2025-2026 student fees ───────────────────────────────────────────────────
# Sheet: "20252026 students"
# Columns: StudentName | September | Oct | Nov | Dec | Jan | Feb | March | April | May | June | July
# Maps to Sep 2025 - Jul 2026

MONTHS_2526 = [
    (2025, 9), (2025, 10), (2025, 11), (2025, 12),
    (2026, 1), (2026, 2), (2026, 3), (2026, 4),
    (2026, 5), (2026, 6), (2026, 7),
]

ws_2526 = wb["20252026 students"]
rows_2526 = list(ws_2526.iter_rows(values_only=True))

for row in rows_2526[1:]:
    name = row[0]
    if not name:
        continue
    name_str = str(name).strip()
    if name_str in ("Total Tuition Per Month", "Number on Roll", ""):
        continue
    for col_idx, (yr, mo) in enumerate(MONTHS_2526):
        val = row[col_idx + 1]
        if is_amount(val):
            fee_receipts.append({
                "studentName": name_str,
                "amount": float(val),
                "date": to_date(yr, mo),
                "academicYear": "2025-2026",
                "paymentMethod": "CASH",
            })

# ── Expenses from cashflow sheet (2024-2025) ─────────────────────────────────
# Rows to import (label → expense category):
EXPENSE_MAP = {
    "Head Teacher":        "Teaching Staff Salaries",
    "Teachers":            "Teaching Staff Salaries",
    "Teaching Assistants": "Support Staff Salaries",
    "Payroll taxes":       "Support Staff Salaries",
    "Food":                "Office Supplies",
    "Maintenance":         "Building Repairs",
    "Rent":                "Building Repairs",
    "Insurance":           "Building Repairs",
    "Telephone":           "Internet",
    "Internet":            "Internet",
    "Electricity":         "Electricity",
    "Water":               "Water",
    "Transportation":      "Transport",
    "Transport":           "Transport",
    "Supplies":            "Office Supplies",
    "Books":               "Office Supplies",
    "Equipment":           "Equipment Maintenance",
}

MONTHS_CF_2425 = [
    (2024, 5), (2024, 6), (2024, 7), (2024, 8),
    (2024, 9), (2024, 10), (2024, 11), (2024, 12),
    (2025, 1), (2025, 2), (2025, 3), (2025, 4),
    (2025, 5), (2025, 6), (2025, 7), (2025, 8),
]  # 16 month columns (Start Up ignored at col 1)

ws_cf = wb["cashflow"]
rows_cf = list(ws_cf.iter_rows(values_only=True))

expenses = []
in_cash_out = False

for row in rows_cf:
    label = str(row[0] or "").strip()

    if "CASH OUT" in label.upper():
        in_cash_out = True
        continue
    if "CASH IN" in label.upper():
        in_cash_out = False
        continue
    if not in_cash_out:
        continue

    # Find matching expense category
    matched_cat = None
    for key, cat in EXPENSE_MAP.items():
        if key.lower() in label.lower():
            matched_cat = cat
            break

    if not matched_cat:
        continue

    for col_idx, (yr, mo) in enumerate(MONTHS_CF_2425):
        val = row[col_idx + 2]  # col 0=label, col 1=StartUp, col 2=May
        if is_amount(val):
            expenses.append({
                "category": matched_cat,
                "description": label.strip(),
                "amount": float(val),
                "date": to_date(yr, mo),
                "academicYear": "2024-2025",
                "paymentMethod": "CASH",
            })

# ── Expenses from cashflow 2025-2026 ─────────────────────────────────────────
MONTHS_CF_2526 = [
    (2025, 9), (2025, 10), (2025, 11), (2025, 12),
    (2026, 1), (2026, 2), (2026, 3), (2026, 4),
    (2026, 5), (2026, 6), (2026, 7), (2026, 8),
    (2026, 9),
]

ws_cf2 = wb["cashflow 20252026 "]
rows_cf2 = list(ws_cf2.iter_rows(values_only=True))

in_cash_out2 = False
for row in rows_cf2:
    label = str(row[0] or "").strip()

    if "CASH OUT" in label.upper():
        in_cash_out2 = True
        continue
    if "CASH IN" in label.upper():
        in_cash_out2 = False
        continue
    if not in_cash_out2:
        continue

    matched_cat = None
    for key, cat in EXPENSE_MAP.items():
        if key.lower() in label.lower():
            matched_cat = cat
            break

    if not matched_cat:
        continue

    for col_idx, (yr, mo) in enumerate(MONTHS_CF_2526):
        val = row[col_idx + 2]
        if is_amount(val):
            expenses.append({
                "category": matched_cat,
                "description": label.strip(),
                "amount": float(val),
                "date": to_date(yr, mo),
                "academicYear": "2025-2026",
                "paymentMethod": "CASH",
            })

# ── Write output ──────────────────────────────────────────────────────────────
result = {
    "feeReceipts": fee_receipts,
    "expenses": expenses,
    "summary": {
        "feeReceiptsCount": len(fee_receipts),
        "expensesCount": len(expenses),
        "totalFeeAmount": sum(r["amount"] for r in fee_receipts),
        "totalExpenseAmount": sum(e["amount"] for e in expenses),
    }
}

with open(OUT, "w") as f:
    json.dump(result, f, indent=2)

print(f"Extracted {len(fee_receipts)} fee receipts and {len(expenses)} expenses")
print(f"Total fees: {result['summary']['totalFeeAmount']:,.2f}")
print(f"Total expenses: {result['summary']['totalExpenseAmount']:,.2f}")
print(f"Written to: {OUT}")
