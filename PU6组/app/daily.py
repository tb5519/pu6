import json
from datetime import datetime, timedelta
from threading import Lock

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
WEEKLY_COMMENTS_MANUAL_KEY = "weekly_comments_manual"
WEEKLY_SUMMARY_FIELDS = ["referral_leads", "referral_conversions", "renewal_orders", "refunds"]
DAILY_SAVE_LOCK = Lock()

REPORT_FIELDS = [
    {"key": "weekly_comments", "label": "点评", "sub_label": "本周总点评量", "has_total": False},
    {"key": "learning_status", "label": "学情", "sub_label": "当天数据", "has_total": True},
    {"key": "referral_leads", "label": "转介绍线索", "sub_label": "当天数据", "has_total": True},
    {"key": "referral_conversions", "label": "转介绍转化", "sub_label": "当天数据", "has_total": True},
    {"key": "refunds", "label": "退费", "sub_label": "当天数据", "has_total": True},
    {"key": "renewal_orders", "label": "续费单量", "sub_label": "当天数据", "has_total": True},
]

LEGACY_FIELD_MAP = {
    "weekly_comments": ["weekly_comment_count", "comments", "today_comment_count"],
    "learning_status": ["today_learning_status_count"],
    "referral_leads": ["referral_new_leads"],
    "referral_conversions": ["referral_conversion_count", "referral_conversions_count"],
    "refunds": ["today_refund_count"],
    "renewal_orders": ["today_renewal_orders"],
}


def daily_report_file():
    return current_app.config["DAILY_REPORT_FILE"]


def monthly_archives_file():
    return current_app.config["MONTHLY_ARCHIVES_FILE"]


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
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(store, file, ensure_ascii=False, indent=2)
    temp_path.replace(path)


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


def has_field_value(source, key):
    if not isinstance(source, dict):
        return False
    if key in source:
        return True
    return any(legacy_key in source for legacy_key in LEGACY_FIELD_MAP.get(key, []))


def weekly_comments_manual_flag(source):
    if not isinstance(source, dict):
        return False
    if WEEKLY_COMMENTS_MANUAL_KEY in source:
        return bool(source.get(WEEKLY_COMMENTS_MANUAL_KEY))
    return has_field_value(source, "weekly_comments")


def selected_month_key(report_date):
    return report_date[:7]


def period_start_for(report_date):
    try:
        path = monthly_archives_file()
        if path.exists():
            with path.open("r", encoding="utf-8") as file:
                store = json.load(file)
            start_date = str(store.get("current_period", {}).get("start_date") or "").strip()
            if start_date and start_date <= report_date:
                return start_date
    except (json.JSONDecodeError, OSError):
        pass
    return f"{selected_month_key(report_date)}-01"


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
    row[WEEKLY_COMMENTS_MANUAL_KEY] = weekly_comments_manual_flag(submitted)
    return row


def saved_rows_by_teacher(report):
    return {
        str(row.get("teacher_id") or row.get("username") or "").strip().lower(): row
        for row in report.get("rows", [])
        if str(row.get("teacher_id") or row.get("username") or "").strip()
    }


def submitted_at_by_teacher(report):
    if not isinstance(report, dict):
        return {}
    submitted_map = report.get("submitted_at_by_teacher")
    if isinstance(submitted_map, dict):
        return {
            str(key or "").strip().lower(): str(value or "")
            for key, value in submitted_map.items()
            if str(key or "").strip()
        }
    submitted_teachers = report.get("submitted_teachers")
    if isinstance(submitted_teachers, list):
        return {
            str(teacher_id or "").strip().lower(): str(report.get("updated_at") or "")
            for teacher_id in submitted_teachers
            if str(teacher_id or "").strip()
        }
    output = {}
    for row in report.get("rows", []):
        teacher_id = str(row.get("teacher_id") or row.get("username") or "").strip().lower()
        if not teacher_id:
            continue
        has_content = any(parse_count(field_value(row, field["key"])) > 0 for field in REPORT_FIELDS)
        if has_content or weekly_comments_manual_flag(row):
            output[teacher_id] = str(report.get("updated_at") or "")
    return output


def build_daily_reminder(store, report_date):
    today_key = datetime.now().strftime("%Y-%m-%d")
    report = store.get("reports", {}).get(report_date, {})
    submitted_map = submitted_at_by_teacher(report)
    teachers = teacher_defaults()
    missing_teachers = [
        {
            "teacher_id": teacher["teacher_id"],
            "teacher_name": teacher["teacher_name"],
        }
        for teacher in teachers
        if teacher["teacher_id"] not in submitted_map
    ]
    current_id = current_teacher_id()
    current_submitted = bool(current_id and current_id in submitted_map)
    current_can_submit = bool(current_id and any(teacher["teacher_id"] == current_id for teacher in teachers))
    is_today = report_date == today_key
    can_manage = can_manage_daily_report()
    show_reminder = is_today and (
        (can_manage and bool(missing_teachers))
        or (current_can_submit and not current_submitted)
    )
    return {
        "date": report_date,
        "today": today_key,
        "is_today": is_today,
        "can_manage": can_manage,
        "current_teacher_id": current_id,
        "current_user_can_submit": current_can_submit,
        "current_user_submitted": current_submitted,
        "submitted_count": len(submitted_map),
        "teacher_count": len(teachers),
        "missing_count": len(missing_teachers),
        "missing_teachers": missing_teachers if can_manage else [],
        "show_reminder": show_reminder,
    }


def calculate_month_totals(store, report_date, rows):
    start_key = period_start_for(report_date)
    totals = {
        row["teacher_id"]: {field["key"]: 0 for field in REPORT_FIELDS}
        for row in rows
    }

    for date_key, report in store.get("reports", {}).items():
        date_text = str(date_key)
        if date_text < start_key or date_text > report_date:
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


def monday_key_for(report_date):
    date_value = datetime.strptime(report_date, "%Y-%m-%d")
    return (date_value - timedelta(days=date_value.weekday())).strftime("%Y-%m-%d")


def should_inherit_monday_comments(report_date):
    weekday = datetime.strptime(report_date, "%Y-%m-%d").weekday()
    return 1 <= weekday <= 4


def apply_weekly_comment_defaults(store, report_date, rows):
    if not should_inherit_monday_comments(report_date):
        return rows

    monday_key = monday_key_for(report_date)
    if monday_key < period_start_for(report_date):
        return rows
    monday_report = store.get("reports", {}).get(monday_key, {})
    monday_rows = saved_rows_by_teacher(monday_report)
    if not monday_rows:
        return rows

    for row in rows:
        if row.get(WEEKLY_COMMENTS_MANUAL_KEY):
            continue
        source = monday_rows.get(row["teacher_id"])
        if not source:
            continue
        row["weekly_comments"] = parse_count(field_value(source, "weekly_comments"))
        row["weekly_comments_inherited_from"] = monday_key
    return rows


def calculate_weekly_base_totals(store, report_date):
    start_key = period_start_for(report_date)
    output = {key: 0 for key in WEEKLY_SUMMARY_FIELDS}
    for date_key, report in store.get("reports", {}).items():
        date_text = str(date_key)
        if date_text < start_key or date_text >= report_date:
            continue
        for row in report.get("rows", []):
            for key in WEEKLY_SUMMARY_FIELDS:
                output[key] += parse_count(field_value(row, key))
    return output


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
    rows = apply_weekly_comment_defaults(store, report_date, rows)
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
        storage_row[WEEKLY_COMMENTS_MANUAL_KEY] = bool(row.get(WEEKLY_COMMENTS_MANUAL_KEY))
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
            "period_start": period_start_for(report_date),
            "fields": REPORT_FIELDS,
            "rows": rows,
            "teachers": teacher_options(),
            "weekly_base": calculate_weekly_base_totals(store, report_date),
            "updated_at": saved_report.get("updated_at", ""),
            "reminder": build_daily_reminder(store, report_date),
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

    submitted_rows = permitted_submitted_rows(payload.get("rows", []))
    if not submitted_rows:
        return jsonify({"error": "当前账号没有可填写的日报行。"}), 403

    with DAILY_SAVE_LOCK:
        store = load_daily_store()
        existing_report = store.get("reports", {}).get(report_date, {})
        submitted_map = submitted_at_by_teacher(existing_report)
        submitted_at = now_iso()
        for row in submitted_rows:
            teacher_id = str(row.get("teacher_id") or row.get("username") or "").strip().lower()
            if teacher_id:
                submitted_map[teacher_id] = submitted_at
        rows = build_report_rows(report_date, store=store, submitted_rows=submitted_rows)
        store.setdefault("reports", {})[report_date] = {
            "date": report_date,
            "rows": rows_for_storage(rows),
            "updated_at": submitted_at,
            "submitted_at_by_teacher": submitted_map,
        }
        save_daily_store(store)
        rows = build_report_rows(report_date, store=store)
        response = {
            "date": report_date,
            "period_start": period_start_for(report_date),
            "fields": REPORT_FIELDS,
            "rows": rows,
            "teachers": teacher_options(),
            "weekly_base": calculate_weekly_base_totals(store, report_date),
            "updated_at": store["reports"][report_date]["updated_at"],
            "reminder": build_daily_reminder(store, report_date),
        }
    return jsonify(response)
