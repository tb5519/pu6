import json
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, request

from app.auth import login_required
from app.teachers import (
    TEACHERS,
    infer_teacher_id_from_class_name,
    normalize_teacher_id,
    teacher_id_for_username,
    teacher_options,
)


daily_bp = Blueprint("daily", __name__, url_prefix="/api/daily-report")
DAILY_ADMIN_ROLES = {"leader", "admin", "manager"}

REPORT_FIELDS = [
    {"key": "lesson_reminders", "label": "催课", "sub_label": "当天数据", "has_total": False},
    {"key": "weekly_comments", "label": "点评", "sub_label": "本周总点评量", "has_total": False},
    {"key": "learning_status", "label": "学情", "sub_label": "当天数据", "has_total": True},
    {"key": "referral_leads", "label": "转介绍线索", "sub_label": "当天数据", "has_total": True},
    {"key": "referral_conversions", "label": "转介绍转化", "sub_label": "当天数据", "has_total": True},
    {"key": "refunds", "label": "退费", "sub_label": "当天数据", "has_total": True},
    {"key": "renewal_orders", "label": "续费单量", "sub_label": "当天数据", "has_total": True},
]

LEGACY_FIELD_MAP = {
    "lesson_reminders": ["today_lesson_reminders"],
    "weekly_comments": ["weekly_comment_count", "comments", "today_comment_count"],
    "learning_status": ["today_learning_status_count"],
    "referral_leads": ["referral_new_leads"],
    "referral_conversions": ["referral_conversion_count", "referral_conversions_count"],
    "refunds": ["today_refund_count"],
    "renewal_orders": ["today_renewal_orders"],
}


def daily_report_file():
    return current_app.config["DAILY_REPORT_FILE"]


def classes_file():
    return current_app.config["CLASSES_FILE"]


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def normalize_report_date(value):
    raw_value = str(value or "").strip()
    if not raw_value:
        return datetime.now().strftime("%Y-%m-%d")
    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise ValueError("日报日期格式不正确。") from None


def load_daily_store():
    path = daily_report_file()
    if not path.exists():
        return {"reports": {}}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_daily_store(store):
    path = daily_report_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(store, file, ensure_ascii=False, indent=2)


def load_classes_store():
    path = classes_file()
    if not path.exists():
        return {"classes": []}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def parse_count(value):
    if value in (None, ""):
        return 0
    try:
        count = int(float(value))
    except (TypeError, ValueError):
        return 0
    return max(0, count)


def field_value(source, key, default=0):
    if not isinstance(source, dict):
        return default
    if key in source:
        return source.get(key)
    for legacy_key in LEGACY_FIELD_MAP.get(key, []):
        if legacy_key in source:
            return source.get(legacy_key)
    return default


def selected_month_key(report_date):
    return report_date[:7]


def student_counts_by_teacher():
    counts = {}
    for item in load_classes_store().get("classes", []):
        teacher_id = normalize_teacher_id(item.get("teacher_id")) or infer_teacher_id_from_class_name(item.get("name"))
        if not teacher_id:
            continue
        counts[teacher_id] = counts.get(teacher_id, 0) + len(item.get("students", []))
    return counts


def teacher_defaults():
    class_counts = student_counts_by_teacher()
    return [
        {
            "username": teacher["id"],
            "teacher_id": teacher["id"],
            "teacher_name": teacher["name"],
            "student_count": class_counts.get(teacher["id"], 0),
        }
        for teacher in TEACHERS
    ]


def current_teacher_id():
    if not g.user:
        return ""
    return normalize_teacher_id(g.user.get("teacher_id")) or teacher_id_for_username(g.user.get("username"))


def can_manage_daily_report():
    return bool(g.user and g.user.get("role") in DAILY_ADMIN_ROLES)


def blank_metrics():
    return {field["key"]: 0 for field in REPORT_FIELDS}


def default_row(teacher):
    return {
        "username": teacher["username"],
        "teacher_id": teacher["teacher_id"],
        "teacher_name": teacher["teacher_name"],
        "student_count": teacher["student_count"],
        **blank_metrics(),
    }


def sanitize_row(default, submitted=None):
    submitted = submitted or {}
    row = {
        "username": default["username"],
        "teacher_id": default["teacher_id"],
        "teacher_name": default["teacher_name"],
        "student_count": default["student_count"],
    }
    for field in REPORT_FIELDS:
        key = field["key"]
        row[key] = parse_count(field_value(submitted, key, default.get(key, 0)))
    return row


def saved_rows_by_teacher(report):
    return {
        str(row.get("teacher_id") or row.get("username") or "").strip().lower(): row
        for row in report.get("rows", [])
        if str(row.get("teacher_id") or row.get("username") or "").strip()
    }


def calculate_month_totals(store, report_date, rows):
    month_key = selected_month_key(report_date)
    totals = {
        row["teacher_id"]: {field["key"]: 0 for field in REPORT_FIELDS}
        for row in rows
    }

    for date_key, report in store.get("reports", {}).items():
        if not str(date_key).startswith(f"{month_key}-") or str(date_key) > report_date:
            continue
        saved_by_teacher = saved_rows_by_teacher(report)
        for row in rows:
            source = saved_by_teacher.get(row["teacher_id"])
            if not source:
                continue
            for field in REPORT_FIELDS:
                if not field.get("has_total", True):
                    continue
                key = field["key"]
                totals[row["teacher_id"]][key] += parse_count(field_value(source, key))
    return totals


def apply_totals(store, report_date, rows):
    totals = calculate_month_totals(store, report_date, rows)
    for row in rows:
        teacher_totals = totals.get(row["teacher_id"], {})
        for field in REPORT_FIELDS:
            if not field.get("has_total", True):
                continue
            key = field["key"]
            row[f"{key}_total"] = teacher_totals.get(key, 0)
    return rows


def apply_edit_permissions(rows):
    if can_manage_daily_report():
        for row in rows:
            row["can_edit"] = True
        return rows

    editable_teacher_id = current_teacher_id()
    for row in rows:
        row["can_edit"] = bool(editable_teacher_id and row["teacher_id"] == editable_teacher_id)
    return rows


def build_report_rows(report_date, store=None, submitted_rows=None):
    store = store or load_daily_store()
    saved_report = store.get("reports", {}).get(report_date, {})
    saved_by_teacher = saved_rows_by_teacher(saved_report)
    submitted_by_teacher = {
        str(row.get("teacher_id") or row.get("username") or "").strip().lower(): row
        for row in (submitted_rows or [])
        if str(row.get("teacher_id") or row.get("username") or "").strip()
    }

    rows = []
    for teacher in teacher_defaults():
        default = default_row(teacher)
        source = submitted_by_teacher.get(teacher["teacher_id"], saved_by_teacher.get(teacher["teacher_id"]))
        rows.append(sanitize_row(default, source))
    return apply_edit_permissions(apply_totals(store, report_date, rows))


def permitted_submitted_rows(submitted_rows):
    if can_manage_daily_report():
        return submitted_rows or []

    editable_teacher_id = current_teacher_id()
    if not editable_teacher_id:
        return []
    return [
        row
        for row in (submitted_rows or [])
        if str(row.get("teacher_id") or row.get("username") or "").strip().lower() == editable_teacher_id
    ]


def rows_for_storage(rows):
    storage_rows = []
    for row in rows:
        storage_row = {
            "username": row["teacher_id"],
            "teacher_id": row["teacher_id"],
            "teacher_name": row["teacher_name"],
            "student_count": row["student_count"],
        }
        for field in REPORT_FIELDS:
            key = field["key"]
            storage_row[key] = row[key]
        storage_rows.append(storage_row)
    return storage_rows


@daily_bp.get("")
@login_required
def get_daily_report():
    try:
        report_date = normalize_report_date(request.args.get("date"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    store = load_daily_store()
    saved_report = store.get("reports", {}).get(report_date, {})
    rows = build_report_rows(report_date)
    return jsonify(
        {
            "date": report_date,
            "fields": REPORT_FIELDS,
            "rows": rows,
            "teachers": teacher_options(),
            "updated_at": saved_report.get("updated_at", ""),
        }
    )


@daily_bp.put("")
@login_required
def save_daily_report():
    payload = request.get_json(silent=True) or {}
    try:
        report_date = normalize_report_date(payload.get("date"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    store = load_daily_store()
    submitted_rows = permitted_submitted_rows(payload.get("rows", []))
    if not submitted_rows:
        return jsonify({"error": "当前账号没有可填写的日报行。"}), 403

    rows = build_report_rows(report_date, store=store, submitted_rows=submitted_rows)
    store.setdefault("reports", {})[report_date] = {
        "date": report_date,
        "rows": rows_for_storage(rows),
        "updated_at": now_iso(),
    }
    save_daily_store(store)
    rows = build_report_rows(report_date, store=store)
    return jsonify(
        {
            "date": report_date,
            "fields": REPORT_FIELDS,
            "rows": rows,
            "teachers": teacher_options(),
            "updated_at": store["reports"][report_date]["updated_at"],
        }
    )
