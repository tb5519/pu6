import json
from calendar import monthrange
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request

from app.auth import login_required
from app.classes import calculate_monthly_completion, classify_student_habit, get_student_weeks
from app.daily import field_value, parse_count
from app.teachers import TEACHERS, infer_teacher_id_from_class_name, normalize_teacher_id, teacher_label


database_bp = Blueprint("database", __name__, url_prefix="/api/database")

COMPLETION_CATEGORIES = ["完课超赞", "异常断课", "长期不上课", "周末欠缺", "偶尔断课", "暂无数据"]
DATABASE_METRICS = {
    "learning": {"field": "learning_status", "label": "学情"},
    "renewal": {"field": "renewal_orders", "label": "续费单量"},
}
REFERRAL_FIELDS = {
    "leads": "referral_leads",
    "conversions": "referral_conversions",
}


def classes_file():
    return current_app.config["CLASSES_FILE"]


def daily_report_file():
    return current_app.config["DAILY_REPORT_FILE"]


def load_json(path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def normalize_month(value):
    raw_value = str(value or "").strip()
    if not raw_value:
        return datetime.now().strftime("%Y-%m")
    try:
        return datetime.strptime(raw_value, "%Y-%m").strftime("%Y-%m")
    except ValueError:
        raise ValueError("统计月份格式不正确。") from None


def normalize_date(value):
    raw_value = str(value or "").strip()
    if not raw_value:
        return datetime.now().strftime("%Y-%m-%d")
    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        raise ValueError("统计日期格式不正确。") from None


def month_end_date(month_key):
    year, month = [int(part) for part in month_key.split("-")]
    return f"{month_key}-{monthrange(year, month)[1]:02d}"


def blank_category_counts():
    return {category: 0 for category in COMPLETION_CATEGORIES}


def average(values):
    valid_values = [value for value in values if value is not None]
    if not valid_values:
        return None
    return round(sum(valid_values) / len(valid_values), 2)


def class_teacher_id(item):
    return normalize_teacher_id(item.get("teacher_id")) or infer_teacher_id_from_class_name(item.get("name"))


def build_completion_summary(month_key):
    store = load_json(classes_file(), {"classes": []})
    teacher_lookup = {
        teacher["id"]: {
            "teacher_id": teacher["id"],
            "teacher_name": teacher["name"],
            "class_count": 0,
            "student_count": 0,
            "active_student_count": 0,
            "completion_values": [],
            "category_counts": blank_category_counts(),
        }
        for teacher in TEACHERS
    }

    classes = []
    total_values = []
    total_categories = blank_category_counts()
    total_students = 0
    active_students = 0

    for item in store.get("classes", []):
        students = item.get("students", [])
        teacher_id = class_teacher_id(item)
        category_counts = blank_category_counts()
        completion_values = []
        active_count = 0

        for student in students:
            weeks = get_student_weeks(student, month_key)
            completion = calculate_monthly_completion(weeks)
            category = classify_student_habit(weeks)
            category_counts[category] = category_counts.get(category, 0) + 1
            total_categories[category] = total_categories.get(category, 0) + 1
            if completion is not None:
                completion_values.append(completion)
                total_values.append(completion)
                active_count += 1

        student_count = len(students)
        total_students += student_count
        active_students += active_count

        teacher_summary = teacher_lookup.get(teacher_id)
        if teacher_summary:
            teacher_summary["class_count"] += 1
            teacher_summary["student_count"] += student_count
            teacher_summary["active_student_count"] += active_count
            teacher_summary["completion_values"].extend(completion_values)
            for category, count in category_counts.items():
                teacher_summary["category_counts"][category] += count

        classes.append(
            {
                "id": item.get("id", ""),
                "name": item.get("name", ""),
                "teacher_id": teacher_id,
                "teacher_name": teacher_label(teacher_id) or "未分配",
                "student_count": student_count,
                "active_student_count": active_count,
                "average_completion": average(completion_values),
                "category_counts": category_counts,
                "updated_at": item.get("updated_at", ""),
            }
        )

    teachers = []
    for teacher in teacher_lookup.values():
        values = teacher.pop("completion_values")
        teachers.append({**teacher, "average_completion": average(values)})

    return {
        "summary": {
            "class_count": len(classes),
            "student_count": total_students,
            "active_student_count": active_students,
            "average_completion": average(total_values),
            "category_counts": total_categories,
        },
        "classes": classes,
        "teachers": teachers,
    }


def report_rows_by_teacher(report):
    return {
        str(row.get("teacher_id") or row.get("username") or "").strip().lower(): row
        for row in report.get("rows", [])
        if str(row.get("teacher_id") or row.get("username") or "").strip()
    }


def build_metric_summary(month_key, report_date, completion_teachers, metric_key):
    field = DATABASE_METRICS[metric_key]["field"]
    store = load_json(daily_report_file(), {"reports": {}})
    rows = {
        teacher["teacher_id"]: {
            "teacher_id": teacher["teacher_id"],
            "teacher_name": teacher["teacher_name"],
            "student_count": teacher["student_count"],
            "today": 0,
            "month_total": 0,
        }
        for teacher in completion_teachers
    }

    for date_key, report in store.get("reports", {}).items():
        date_text = str(date_key)
        if not date_text.startswith(f"{month_key}-") or date_text > report_date:
            continue
        saved_rows = report_rows_by_teacher(report)
        for teacher_id, output in rows.items():
            source = saved_rows.get(teacher_id)
            if not source:
                continue
            value = parse_count(field_value(source, field))
            output["month_total"] += value
            if date_text == report_date:
                output["today"] += value

    row_list = list(rows.values())
    return {
        "field": field,
        "label": DATABASE_METRICS[metric_key]["label"],
        "today_total": sum(row["today"] for row in row_list),
        "month_total": sum(row["month_total"] for row in row_list),
        "rows": row_list,
    }


def build_referral_summary(month_key, report_date, completion_teachers):
    store = load_json(daily_report_file(), {"reports": {}})
    rows = {
        teacher["teacher_id"]: {
            "teacher_id": teacher["teacher_id"],
            "teacher_name": teacher["teacher_name"],
            "student_count": teacher["student_count"],
            "leads_today": 0,
            "leads_month_total": 0,
            "conversions_today": 0,
            "conversions_month_total": 0,
        }
        for teacher in completion_teachers
    }

    for date_key, report in store.get("reports", {}).items():
        date_text = str(date_key)
        if not date_text.startswith(f"{month_key}-") or date_text > report_date:
            continue
        saved_rows = report_rows_by_teacher(report)
        for teacher_id, output in rows.items():
            source = saved_rows.get(teacher_id)
            if not source:
                continue
            leads = parse_count(field_value(source, REFERRAL_FIELDS["leads"]))
            conversions = parse_count(field_value(source, REFERRAL_FIELDS["conversions"]))
            output["leads_month_total"] += leads
            output["conversions_month_total"] += conversions
            if date_text == report_date:
                output["leads_today"] += leads
                output["conversions_today"] += conversions

    row_list = list(rows.values())
    return {
        "label": "转介绍",
        "leads_today_total": sum(row["leads_today"] for row in row_list),
        "leads_month_total": sum(row["leads_month_total"] for row in row_list),
        "conversions_today_total": sum(row["conversions_today"] for row in row_list),
        "conversions_month_total": sum(row["conversions_month_total"] for row in row_list),
        "rows": row_list,
    }


@database_bp.get("/summary")
@login_required
def database_summary():
    try:
        month_key = normalize_month(request.args.get("month"))
        report_date = normalize_date(request.args.get("date"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    if not report_date.startswith(f"{month_key}-"):
        current_date = datetime.now().strftime("%Y-%m-%d")
        report_date = current_date if current_date.startswith(f"{month_key}-") else month_end_date(month_key)

    completion = build_completion_summary(month_key)
    completion_teachers = completion["teachers"]
    return jsonify(
        {
            "month": month_key,
            "date": report_date,
            "completion": completion,
            "learning": build_metric_summary(month_key, report_date, completion_teachers, "learning"),
            "renewal": build_metric_summary(month_key, report_date, completion_teachers, "renewal"),
            "referral": build_referral_summary(month_key, report_date, completion_teachers),
            "updated_at": datetime.now().isoformat(timespec="seconds"),
        }
    )
