import csv
import io
import json
import re
import uuid
from datetime import datetime

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from flask import Blueprint, current_app, g, jsonify, request, send_file

from app.auth import can_manage_accounts, login_required
from app.classes import (
    calculate_monthly_completion,
    class_teacher_id,
    current_month_key,
    get_student_weeks,
    load_store as load_class_store,
    save_store as save_class_store,
)
from app.teachers import TEACHERS, normalize_match_text, normalize_teacher_id, teacher_id_for_username, teacher_label


renewal_bp = Blueprint("renewal", __name__, url_prefix="/api/renewal")

RENEWAL_STAGES = ["铺垫阶段", "续报首月", "续报次月", "结营续报"]
FOLLOWUP_STATUSES = ["愿意继续学", "需要考虑", "拒绝", "未接听"]
FOLLOWUP_PRIORITIES = ["重点跟进", "高意向", "可继续沟通", "暂缓跟进"]
RENEWAL_FIRST_MONTH_STAGE = "续报首月"
RENEWAL_SECOND_MONTH_STAGE = "续报次月"
RENEWAL_FOUR_WEEK_STAGES = {RENEWAL_FIRST_MONTH_STAGE, RENEWAL_SECOND_MONTH_STAGE}
RENEWAL_CLOSING_STAGE = "结营续报"
RENEWAL_SINGLE_FOLLOWUP_STAGES = {RENEWAL_CLOSING_STAGE}
RENEWAL_PRIORITY_STAGES = {*RENEWAL_FOUR_WEEK_STAGES, *RENEWAL_SINGLE_FOLLOWUP_STAGES}
FOLLOWUP_METHODS = ["私信", "电话"]
LEADER_ACTION_TYPES = ["留言", "去电", "跟进"]
BLOCKER_OPTIONS = ["升初中", "时间紧张", "经济", "学员问题", "线下", "效果不满意", "不知道顾虑", "不回复", "拒绝早报"]
DEFAULT_RENEWAL_WEEK_COUNT = 4
MAX_RENEWAL_WEEK_COUNT = 8
CHINESE_WEEK_NUMBERS = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
}
RENEWAL_WEEK_LABELS = {
    1: "第一周",
    2: "第二周",
    3: "第三周",
    4: "第四周",
    5: "第五周",
    6: "第六周",
    7: "第七周",
    8: "第八周",
}
FOLLOWUP_STATUS_PRIORITY = {
    "愿意继续学": 0,
    "需要考虑": 1,
    "未接听": 2,
    "拒绝": 3,
    "": 4,
}
FOLLOWUP_PRIORITY_RANK = {priority: index for index, priority in enumerate(FOLLOWUP_PRIORITIES)}
FOLLOWUP_PRIORITY_RANK[""] = len(FOLLOWUP_PRIORITIES)


def renewal_file():
    return current_app.config["RENEWAL_PROJECTS_FILE"]


def monthly_archives_file():
    return current_app.config["MONTHLY_ARCHIVES_FILE"]


def database_settings_file():
    return current_app.config["DATABASE_SETTINGS_FILE"]


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def today_key():
    return datetime.now().strftime("%Y-%m-%d")


def load_monthly_archive_store():
    path = monthly_archives_file()
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def load_database_settings_store():
    path = database_settings_file()
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def parse_period_date(value):
    text = str(value or "").strip()[:10]
    if not text:
        return ""
    try:
        datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        return ""
    return text


def normalize_closing_month(value):
    """Return a valid manual closing month, or an empty value when unset."""
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        return datetime.strptime(text, "%Y-%m").strftime("%Y-%m")
    except ValueError:
        return ""


def current_period_start_key(reference_date=None):
    report_date = str(reference_date or today_key())[:10]
    store = load_monthly_archive_store()
    start_date = str(store.get("current_period", {}).get("start_date") or "").strip()
    if start_date and start_date <= report_date:
        return start_date
    return f"{report_date[:7]}-01"


def current_period_key():
    return current_period_start_key()


def current_period_label():
    return f"{current_period_start_key()}起"


def saved_renewal_period_for(report_date):
    settings = load_database_settings_store()
    periods = settings.get("performance_periods")
    if not isinstance(periods, dict):
        return None

    def normalize(raw_period):
        if not isinstance(raw_period, dict):
            return None
        start_date = parse_period_date(raw_period.get("start_date"))
        end_date = parse_period_date(raw_period.get("end_date"))
        if not start_date or not end_date or end_date < start_date:
            return None
        return {"start_date": start_date, "end_date": end_date, "is_custom": True}

    section_keys = ("renewal", "completion")
    month_key = str(report_date or "")[:7]
    month_settings = periods.get(month_key)
    if isinstance(month_settings, dict):
        for section_key in section_keys:
            current_month_period = normalize(month_settings.get(section_key))
            if current_month_period:
                return current_month_period

    for month_settings in periods.values():
        if not isinstance(month_settings, dict):
            continue
        for section_key in section_keys:
            period = normalize(month_settings.get(section_key))
            if period and period["start_date"] <= report_date <= period["end_date"]:
                return period
    return None


def renewal_followup_period(reference_date=None):
    report_date = str(reference_date or today_key())[:10]
    saved_period = saved_renewal_period_for(report_date)
    if saved_period:
        return saved_period
    return {
        "start_date": current_period_start_key(report_date),
        "end_date": report_date,
        "is_custom": False,
    }


def clamp_renewal_week_count(value):
    try:
        count = int(value)
    except (TypeError, ValueError):
        return DEFAULT_RENEWAL_WEEK_COUNT
    return max(1, min(MAX_RENEWAL_WEEK_COUNT, count))


def renewal_week_count(reference_date=None):
    period = renewal_followup_period(reference_date)
    try:
        start = datetime.strptime(period["start_date"], "%Y-%m-%d")
        end = datetime.strptime(period["end_date"], "%Y-%m-%d")
    except (KeyError, ValueError):
        return DEFAULT_RENEWAL_WEEK_COUNT
    days = max(1, (end - start).days + 1)
    return clamp_renewal_week_count((days + 6) // 7)


def renewal_week_options(reference_date=None):
    return [
        {"key": str(week), "label": RENEWAL_WEEK_LABELS.get(week, f"第{week}周")}
        for week in range(1, renewal_week_count(reference_date) + 1)
    ]


def previous_month_key(month_key):
    year, month = [int(part) for part in str(month_key).split("-")]
    if month == 1:
        return f"{year - 1}-12"
    return f"{year}-{month - 1:02d}"


def renewal_completion_month_key():
    return previous_month_key(current_month_key())


def current_owner():
    return g.user["username"]


def current_teacher_id():
    return (
        normalize_teacher_id(g.user.get("teacher_id"))
        or normalize_teacher_id(g.user.get("username"))
        or teacher_id_for_username(g.user.get("username"))
    )


def load_store():
    path = renewal_file()
    if not path.exists():
        return {"projects": [], "blocker_options": [], "legacy_followups": []}
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        return {"projects": [], "blocker_options": [], "legacy_followups": []}
    projects = data.get("projects")
    if not isinstance(projects, list):
        data["projects"] = []
    if not isinstance(data.get("blocker_options"), list):
        data["blocker_options"] = []
    if not isinstance(data.get("legacy_followups"), list):
        data["legacy_followups"] = []
    return data


def save_store(store):
    path = renewal_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(store, file, ensure_ascii=False, indent=2)


def normalize_stage(value):
    stage = str(value or "").strip()
    return stage if stage in RENEWAL_STAGES else RENEWAL_STAGES[0]


def normalize_followup_status(value):
    status = str(value or "").strip()
    return status if status in FOLLOWUP_STATUSES else ""


def normalize_followup_priority(value):
    priority = str(value or "").strip()
    return priority if priority in FOLLOWUP_PRIORITIES else ""


def normalize_leader_action_type(value):
    action_type = str(value or "").strip()
    return action_type if action_type in LEADER_ACTION_TYPES else LEADER_ACTION_TYPES[0]


def normalize_blocker_option(value):
    return str(value or "").strip()[:24]


def blocker_options(store=None):
    data = store if isinstance(store, dict) else load_store()
    options = []
    for option in [*BLOCKER_OPTIONS, *data.get("blocker_options", [])]:
        normalized = normalize_blocker_option(option)
        if normalized and normalized not in options:
            options.append(normalized)
    return options


def normalize_blocker(value, store=None):
    blocker = str(value or "").strip()
    return blocker if blocker in blocker_options(store) else ""


def normalize_followup_methods(value):
    if isinstance(value, list):
        raw_methods = value
    else:
        raw_methods = str(value or "").replace("、", ",").split(",")
    methods = []
    for item in raw_methods:
        method = str(item or "").strip()
        if method in FOLLOWUP_METHODS and method not in methods:
            methods.append(method)
    return methods


def normalize_followup_date(value):
    text = str(value or "").strip()[:10]
    if not text:
        return datetime.now().strftime("%Y-%m-%d")
    try:
        return datetime.strptime(text, "%Y-%m-%d").strftime("%Y-%m-%d")
    except ValueError:
        return datetime.now().strftime("%Y-%m-%d")


def format_followup_date(value):
    text = str(value or "").strip()[:10]
    if not text:
        return ""
    try:
        parsed = datetime.strptime(text, "%Y-%m-%d")
    except ValueError:
        return text
    return f"{parsed.month}.{parsed.day}"


def renewal_week_keys(value=None, minimum_count=None):
    week_numbers = set(range(1, clamp_renewal_week_count(minimum_count or renewal_week_count()) + 1))
    if isinstance(value, dict):
        for key in value.keys():
            try:
                week = int(str(key))
            except (TypeError, ValueError):
                continue
            if 1 <= week <= MAX_RENEWAL_WEEK_COUNT:
                week_numbers.add(week)
    return [str(week) for week in sorted(week_numbers)]


def normalize_weekly_followups(value, week_count=None):
    week_keys = renewal_week_keys(value, week_count)
    output = {week_key: [] for week_key in week_keys}
    if not isinstance(value, dict):
        return output
    for week_key in week_keys:
        records = value.get(week_key, [])
        if not isinstance(records, list):
            continue
        collapsed = {}
        for record in records:
            if not isinstance(record, dict):
                continue
            methods = normalize_followup_methods(record.get("methods"))
            if not methods:
                continue
            date_key = normalize_followup_date(record.get("date"))
            current = collapsed.setdefault(date_key, {
                "date": date_key,
                "methods": [],
                "created_at": "",
            })
            for method in methods:
                if method not in current["methods"]:
                    current["methods"].append(method)
            current["created_at"] = str(record.get("created_at") or record.get("createdAt") or current["created_at"])
        output[week_key] = [
            {
                "date": item.get("date", ""),
                "methods": methods,
                "created_at": item.get("created_at", ""),
            }
            for item in sorted(
                collapsed.values(),
                key=lambda value: (value.get("date", ""), value.get("created_at", "")),
            )
            for methods in [item.get("methods", [])]
        ]
    return output


def normalize_general_followups(value):
    if not isinstance(value, list):
        return []
    collapsed = {}
    for record in value:
        if not isinstance(record, dict):
            continue
        methods = normalize_followup_methods(record.get("methods"))
        if not methods:
            continue
        date_key = normalize_followup_date(record.get("date"))
        current = collapsed.setdefault(date_key, {
            "date": date_key,
            "methods": [],
            "created_at": "",
        })
        for method in methods:
            if method not in current["methods"]:
                current["methods"].append(method)
        current["created_at"] = str(record.get("created_at") or record.get("createdAt") or current["created_at"])
    return [
        {
            "date": item.get("date", ""),
            "methods": item.get("methods", []),
            "created_at": item.get("created_at", ""),
        }
        for item in sorted(
            collapsed.values(),
            key=lambda value: (value.get("date", ""), value.get("created_at", "")),
        )
    ]


def serialize_weekly_followups(record):
    week_count = renewal_week_count()
    weekly_followups = normalize_weekly_followups(record.get("weekly_followups"), week_count)
    output = {}
    for week in range(1, week_count + 1):
        week_key = str(week)
        records = [
            {
                "date": item.get("date", ""),
                "date_label": format_followup_date(item.get("date")),
                "methods": item.get("methods", []),
                "created_at": format_followup_time(item.get("created_at")),
            }
            for item in sorted(
                weekly_followups.get(week_key, []),
                key=lambda value: (value.get("date", ""), value.get("created_at", "")),
            )
        ]
        latest = records[-1] if records else {}
        output[week_key] = {
            "latest_date": latest.get("date", ""),
            "latest_date_label": latest.get("date_label", ""),
            "latest_methods": latest.get("methods", []),
            "count": len(records),
            "records": records,
        }
    return output


def serialize_general_followups(record, include_weekly=False):
    source_records = normalize_general_followups(record.get("general_followups"))
    if include_weekly:
        for week_records in normalize_weekly_followups(record.get("weekly_followups")).values():
            source_records.extend(week_records)
        source_records = normalize_general_followups(source_records)
    records = [
        {
            "date": item.get("date", ""),
            "date_label": format_followup_date(item.get("date")),
            "methods": item.get("methods", []),
            "created_at": format_followup_time(item.get("created_at")),
        }
        for item in source_records
    ]
    latest = records[-1] if records else {}
    return {
        "latest_date": latest.get("date", ""),
        "latest_date_label": latest.get("date_label", ""),
        "latest_methods": latest.get("methods", []),
        "count": len(records),
        "records": records,
    }


def class_lookup():
    return {item.get("id"): item for item in load_class_store().get("classes", []) if item.get("id")}


def can_read_class(item):
    return can_manage_accounts() or item.get("owner") == current_owner()


def can_add_class(item):
    return item.get("owner") == current_owner()


def can_edit_project(project):
    return can_manage_accounts() or project.get("owner") == current_owner()


def can_read_project(project):
    return can_edit_project(project)


def source_class_student_count(source_class):
    return len(source_class.get("students", [])) if source_class else 0


def normalize_locked_student_count(value, fallback=0):
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = int(fallback or 0)
    return max(0, min(count, 9999))


def normalize_target_count(value):
    if value in (None, ""):
        return None
    try:
        count = int(value)
    except (TypeError, ValueError):
        return None
    return max(0, min(count, 9999))


def normalize_manual_enrolled_count(value):
    return normalize_target_count(value)


def project_target_settings(project):
    settings = project.get("monthly_targets")
    if isinstance(settings, dict):
        return settings
    project["monthly_targets"] = {}
    return project["monthly_targets"]


def project_month_target(project, month_key=None):
    month = month_key or current_period_key()
    settings = project.get("monthly_targets")
    if isinstance(settings, dict):
        month_settings = settings.get(month)
        if isinstance(month_settings, dict):
            return normalize_target_count(month_settings.get("target_count"))
        legacy_month = current_month_key()
        legacy_settings = settings.get(legacy_month)
        if month.endswith("-01") and isinstance(legacy_settings, dict):
            return normalize_target_count(legacy_settings.get("target_count"))
    return normalize_target_count(project.get("target_count"))


def enrollment_date_key(record):
    if not isinstance(record, dict) or not record.get("enrolled"):
        return ""
    enrolled_at = str(record.get("enrolled_at") or "").strip()
    if len(enrolled_at) >= 10:
        return enrolled_at[:10]
    return ""


def month_enrolled_student_ids(project, source_class=None, month_key=None):
    start_key = month_key or current_period_start_key()
    end_key = today_key()
    return {
        str(student_id)
        for student_id, record in (project.get("student_followups") or {}).items()
        for enrolled_date in [enrollment_date_key(record)]
        if enrolled_date and start_key <= enrolled_date <= end_key
    }


def set_project_month_target(project, value, month_key=None):
    month = month_key or current_period_key()
    target_count = normalize_target_count(value)
    settings = project_target_settings(project)
    if target_count is None:
        settings.pop(month, None)
    else:
        settings[month] = {
            "target_count": target_count,
            "updated_at": now_iso(),
            "updated_by": current_owner(),
        }
    project.pop("target_count", None)
    return target_count


def ensure_project_student_count_lock(project, source_class):
    if "locked_student_count" in project:
        if "student_count_note" not in project:
            project["student_count_note"] = ""
            return True
        return False
    project["locked_student_count"] = source_class_student_count(source_class) or len(normalize_project_student_snapshot(project))
    project["student_count_note"] = str(project.get("student_count_note") or "").strip()[:300]
    return True


def project_student_count(project, source_class):
    return normalize_locked_student_count(
        project.get("locked_student_count"),
        fallback=source_class_student_count(source_class) or len(normalize_project_student_snapshot(project)),
    )


def find_project(store, project_id):
    return next((item for item in store.get("projects", []) if item.get("id") == project_id), None)


def enrolled_student_ids(project, source_class=None):
    followups = project.get("student_followups", {})
    ids = {
        str(student_id)
        for student_id, record in followups.items()
        if bool((record or {}).get("enrolled"))
    }
    ids.update(
        str(value)
        for value in project.get("enrolled_student_ids", [])
        if str(value or "").strip() and str(value) not in followups
    )
    return ids


def project_manual_enrolled_count(project, student_count=None):
    manual_count = normalize_manual_enrolled_count(project.get("manual_enrolled_count"))
    if manual_count is None:
        return None
    if student_count is not None and int(student_count or 0) > 0:
        return min(manual_count, int(student_count or 0))
    return manual_count


def project_enrollment_counts(project, source_class=None):
    student_count = project_student_count(project, source_class)
    checked_enrolled_count = len(enrolled_student_ids(project, source_class))
    manual_enrolled_count = project_manual_enrolled_count(project, student_count)
    enrolled_count = manual_enrolled_count if manual_enrolled_count is not None else checked_enrolled_count
    return student_count, checked_enrolled_count, manual_enrolled_count, enrolled_count


def project_manual_month_enrolled_count(project, month_key=None):
    month = month_key or current_period_key()
    breakdowns = project.get("monthly_enrollment_breakdowns")
    if isinstance(breakdowns, dict):
        settings = breakdowns.get(month)
        if isinstance(settings, dict):
            return normalize_target_count(settings.get("month_enrolled_count"))
    # Kept only for compatibility with any local data saved during the transition.
    return normalize_target_count(project.get("manual_month_enrolled_count"))


def set_project_manual_month_enrolled_count(project, value, month_key=None):
    month = month_key or current_period_key()
    month_enrolled_count = normalize_target_count(value)
    breakdowns = project.get("monthly_enrollment_breakdowns")
    if not isinstance(breakdowns, dict):
        breakdowns = {}
        project["monthly_enrollment_breakdowns"] = breakdowns
    if month_enrolled_count is None:
        breakdowns.pop(month, None)
    else:
        breakdowns[month] = {
            "month_enrolled_count": month_enrolled_count,
            "updated_at": now_iso(),
            "updated_by": current_owner(),
        }
    project.pop("manual_month_enrolled_count", None)
    return month_enrolled_count


def project_enrollment_breakdown(project, enrolled_count, source_class=None):
    detected_month_enrolled_count = len(month_enrolled_student_ids(project, source_class))
    manual_month_enrolled_count = project_manual_month_enrolled_count(project)
    month_enrolled_count = (
        manual_month_enrolled_count
        if manual_month_enrolled_count is not None
        else detected_month_enrolled_count
    )
    month_enrolled_count = min(max(0, month_enrolled_count), max(0, enrolled_count))
    historical_enrolled_count = max(0, enrolled_count - month_enrolled_count)
    return (
        detected_month_enrolled_count,
        manual_month_enrolled_count,
        month_enrolled_count,
        historical_enrolled_count,
    )


def prune_project_followups(project, source_class):
    return False


def prune_store_followups(store, classes_by_id):
    changed = False
    for project in store.get("projects", []):
        source_class = classes_by_id.get(project.get("class_id"))
        changed = prune_project_followups(project, source_class) or changed
    return changed


def student_followup_record(project, student_id):
    followups = project.setdefault("student_followups", {})
    student_key = str(student_id)
    record = followups.setdefault(student_key, {})
    if student_key in {str(value) for value in project.get("enrolled_student_ids", [])} and "enrolled" not in record:
        record["enrolled"] = True
    record["status"] = normalize_followup_status(record.get("status"))
    record["enrolled"] = bool(record.get("enrolled"))
    record["current_blocker"] = normalize_blocker(record.get("current_blocker"))
    record["priority"] = normalize_followup_priority(record.get("priority"))
    record["weekly_followups"] = normalize_weekly_followups(record.get("weekly_followups"))
    record["general_followups"] = normalize_general_followups(record.get("general_followups"))
    record["notes"] = normalize_note_entries(record)
    record["note"] = note_history_text(record)
    record["leader_action_type"] = normalize_leader_action_type(record.get("leader_action_type"))
    record["leader_note"] = str(record.get("leader_note") or "").strip()[:500]
    record["leader_talk_keyword"] = str(record.get("leader_talk_keyword") or "").strip()[:120]
    record["leader_talk_type"] = str(record.get("leader_talk_type") or "").strip()[:40]
    record["leader_talk_title"] = str(record.get("leader_talk_title") or "").strip()[:180]
    record["leader_talk_text"] = str(record.get("leader_talk_text") or "").strip()[:5000]
    record["leader_note_done"] = bool(record.get("leader_note_done"))
    record["leader_note_updated_at"] = str(record.get("leader_note_updated_at") or "")
    record["leader_note_done_at"] = str(record.get("leader_note_done_at") or "")
    record["followed_at"] = str(record.get("followed_at") or "")
    return record


def format_followup_time(value):
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        return datetime.fromisoformat(text).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        return text


def normalize_note_entries(record):
    entries = []
    seen = set()
    raw_entries = record.get("notes")
    if isinstance(raw_entries, list):
        for item in raw_entries:
            if isinstance(item, dict):
                text = str(item.get("text") or "").strip()
                created_at = str(item.get("created_at") or "")
            else:
                text = str(item or "").strip()
                created_at = ""
            if not text:
                continue
            updated_at = str(item.get("updated_at") or "") if isinstance(item, dict) else ""
            key = (text, created_at, updated_at)
            if key in seen:
                continue
            seen.add(key)
            entries.append({
                "text": text[:500],
                "created_at": created_at,
                "updated_at": updated_at,
            })
    legacy_note = str(record.get("note") or "").strip()
    if legacy_note and not entries:
        for line in [item.strip() for item in legacy_note.replace("\r", "\n").split("\n")]:
            if not line:
                continue
            key = (line, "", "")
            if key in seen:
                continue
            seen.add(key)
            entries.append({
                "text": line[:500],
                "created_at": str(record.get("followed_at") or ""),
                "updated_at": "",
            })
    return entries[-30:]


def note_history_text(record):
    return "\n".join(item.get("text", "") for item in normalize_note_entries(record) if item.get("text"))


def append_followup_note(record, value, prefix_date=False):
    text = str(value or "").strip()
    if not text:
        return False
    if prefix_date and not re.match(r"^\d{1,2}\.\d{1,2}", text):
        text = f"{format_followup_date(today_key())}{text}"
    entries = normalize_note_entries(record)
    entries.append({
        "text": text[:500],
        "created_at": now_iso(),
    })
    entries = entries[-30:]
    record["notes"] = entries
    record["note"] = "\n".join(item.get("text", "") for item in entries if item.get("text"))
    return True


def replace_followup_note(record, value):
    text = str(value or "").strip()
    current_text = note_history_text(record).strip()
    if text == current_text:
        return False
    if not text:
        return set_followup_note_entries(record, [])
    entries = normalize_note_entries(record)
    created_at = entries[0].get("created_at") if entries else now_iso()
    return set_followup_note_entries(record, [{
        "text": text[:500],
        "created_at": created_at or now_iso(),
        "updated_at": now_iso() if entries else "",
    }])


def set_followup_note_entries(record, entries):
    clean_entries = []
    for item in entries:
        text = str((item or {}).get("text") or "").strip()
        if not text:
            continue
        clean_entries.append({
            "text": text[:500],
            "created_at": str((item or {}).get("created_at") or ""),
            "updated_at": str((item or {}).get("updated_at") or ""),
        })
    clean_entries = clean_entries[-30:]
    record["notes"] = clean_entries
    record["note"] = "\n".join(item.get("text", "") for item in clean_entries if item.get("text"))
    return True


def update_followup_note(record, payload):
    if not isinstance(payload, dict):
        return False
    try:
        index = int(payload.get("index"))
    except (TypeError, ValueError):
        return False
    text = str(payload.get("text") or "").strip()
    if not text:
        return False
    entries = normalize_note_entries(record)
    if index < 0 or index >= len(entries):
        return False
    if entries[index].get("text") == text[:500]:
        return False
    entries[index]["text"] = text[:500]
    entries[index]["updated_at"] = now_iso()
    return set_followup_note_entries(record, entries)


def delete_followup_note(record, payload):
    try:
        index = int(payload.get("index") if isinstance(payload, dict) else payload)
    except (TypeError, ValueError):
        return False
    entries = normalize_note_entries(record)
    if index < 0 or index >= len(entries):
        return False
    entries.pop(index)
    return set_followup_note_entries(record, entries)


def append_weekly_followup(record, payload):
    try:
        week = int(payload.get("week"))
    except (TypeError, ValueError):
        return False
    if week < 1 or week > renewal_week_count():
        return False
    methods = normalize_followup_methods(payload.get("methods"))
    if not methods:
        return False
    entry = {
        "date": normalize_followup_date(payload.get("date")),
        "methods": methods,
        "created_at": now_iso(),
    }
    weekly_followups = normalize_weekly_followups(record.get("weekly_followups"))
    week_records = weekly_followups.setdefault(str(week), [])
    existing = next((item for item in week_records if item.get("date") == entry["date"]), None)
    if existing is None:
        week_records.append(entry)
    else:
        existing["methods"] = methods
        existing["created_at"] = entry["created_at"]
    record["weekly_followups"] = weekly_followups
    record["followed_at"] = entry["created_at"]
    return True


def append_general_followup(record, payload):
    methods = normalize_followup_methods(payload.get("methods"))
    if not methods:
        return False
    entry = {
        "date": normalize_followup_date(payload.get("date")),
        "methods": methods,
        "created_at": now_iso(),
    }
    general_followups = normalize_general_followups(record.get("general_followups"))
    existing = next((item for item in general_followups if item.get("date") == entry["date"]), None)
    if existing is None:
        general_followups.append(entry)
    else:
        existing["methods"] = methods
        existing["created_at"] = entry["created_at"]
    record["general_followups"] = normalize_general_followups(general_followups)
    record["followed_at"] = entry["created_at"]
    return True


RENEWAL_UPLOAD_COLUMN_ALIASES = {
    "teacher": ["班主任", "老师", "带班老师", "组员"],
    "class_name": ["班级名称", "班级名", "班级"],
    "stage": ["续费阶段", "阶段", "当前阶段"],
    "student_name": ["学员姓名", "学生姓名", "姓名", "学员"],
    "student_account": ["学员账号", "学习账号", "学生账号", "账号", "手机号"],
    "followup_status": ["铺垫情况", "跟进情况", "意向情况", "意向", "铺垫电话"],
    "enrolled": ["是否报名", "已报名", "报名状态"],
    "blocker": ["当前卡点", "卡点", "顾虑", "当前顾虑"],
    "week": ["跟进周数", "周数", "第几周", "续费周数"],
    "date": ["跟进时间", "跟进日期", "时间", "日期"],
    "methods": ["跟进方式", "沟通方式", "方式"],
    "note": ["备注", "跟进备注", "沟通记录", "记录"],
}


def upload_cell_text(value):
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def normalize_upload_header(value):
    return re.sub(r"[\s\ufeff:：()（）【】\[\]_-]+", "", str(value or "").lower())


def renewal_upload_column_key(header):
    normalized = normalize_upload_header(header)
    if not normalized:
        return ""
    for key, aliases in RENEWAL_UPLOAD_COLUMN_ALIASES.items():
        for alias in aliases:
            alias_key = normalize_upload_header(alias)
            if alias_key and (normalized == alias_key or alias_key in normalized):
                return key
    return ""


def mapped_upload_rows(rows, sheet_name=""):
    best_score = 0
    header_index = None
    header_map = {}
    for index, row in enumerate(rows[:20]):
        current_map = {}
        for column_index, value in enumerate(row):
            key = renewal_upload_column_key(value)
            if key and key not in current_map:
                current_map[key] = column_index
        score = len(current_map)
        if "class_name" in current_map:
            score += 3
        if "student_account" in current_map or "student_name" in current_map:
            score += 3
        if score > best_score:
            best_score = score
            header_index = index
            header_map = current_map
    if header_index is None or "class_name" not in header_map or not (
        "student_account" in header_map or "student_name" in header_map
    ):
        return []

    records = []
    for row_number, row in enumerate(rows[header_index + 1:], start=header_index + 2):
        if not any(upload_cell_text(value) for value in row):
            continue
        record = {
            key: upload_cell_text(row[column_index]) if column_index < len(row) else ""
            for key, column_index in header_map.items()
        }
        if not (
            record.get("class_name")
            or record.get("student_account")
            or record.get("student_name")
            or record.get("note")
        ):
            continue
        record["_row_number"] = row_number
        record["_sheet_name"] = sheet_name
        records.append(record)
    return records


def parse_renewal_upload_file(file_storage):
    filename = (file_storage.filename or "").lower()
    file_storage.stream.seek(0)
    if filename.endswith(".csv"):
        raw_content = file_storage.stream.read()
        try:
            text = raw_content.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw_content.decode("gb18030", errors="ignore")
        rows = [
            [upload_cell_text(value) for value in row]
            for row in csv.reader(io.StringIO(text))
        ]
        return mapped_upload_rows(rows, "CSV")

    if filename.endswith(".xlsx"):
        workbook = load_workbook(file_storage.stream, read_only=True, data_only=True)
        records = []
        for worksheet in workbook.worksheets:
            rows = [
                [upload_cell_text(value) for value in row]
                for row in worksheet.iter_rows(values_only=True)
            ]
            records.extend(mapped_upload_rows(rows, worksheet.title))
        return records

    raise ValueError("请上传 .xlsx 或 .csv 格式的续费历史数据表。")


def teacher_id_from_upload(value):
    text = str(value or "").strip()
    if not text:
        return ""
    normalized_id = normalize_teacher_id(text) or teacher_id_for_username(text)
    if normalized_id:
        return normalized_id
    text_key = normalize_match_text(text)
    for teacher in TEACHERS:
        candidates = [teacher.get("id"), teacher.get("username"), teacher.get("name"), *teacher.get("aliases", [])]
        if any(normalize_match_text(candidate) == text_key for candidate in candidates):
            return teacher.get("id", "")
    return ""


def normalize_upload_stage(value):
    stage = str(value or "").strip()
    if stage in RENEWAL_STAGES:
        return stage
    if "次月" in stage:
        return RENEWAL_SECOND_MONTH_STAGE
    if "首月" in stage:
        return RENEWAL_FIRST_MONTH_STAGE
    if "结营" in stage:
        return "结营续报"
    if "铺垫" in stage:
        return "铺垫阶段"
    return ""


def normalize_upload_status(value):
    status = str(value or "").strip()
    if status in FOLLOWUP_STATUSES:
        return status
    if any(keyword in status for keyword in ("愿意", "继续", "高意向", "想报")):
        return "愿意继续学"
    if "考虑" in status:
        return "需要考虑"
    if "拒绝" in status:
        return "拒绝"
    if "未接" in status or "没接" in status or "未通" in status:
        return "未接听"
    return ""


def normalize_upload_methods(value):
    text = str(value or "").strip()
    if not text:
        return []
    methods = []
    if any(keyword in text for keyword in ("私信", "微信", "私聊")):
        methods.append("私信")
    if any(keyword in text for keyword in ("电话", "去电", "拨打")):
        methods.append("电话")
    if not methods:
        methods = normalize_followup_methods(text)
    return methods


def parse_upload_bool(value):
    text = str(value or "").strip().lower()
    if not text:
        return None
    if text in {"1", "true", "yes", "y", "是", "已报名", "报名", "已报"}:
        return True
    if text in {"0", "false", "no", "n", "否", "未报名", "未报", "没有"}:
        return False
    return None


def parse_upload_week(value):
    text = str(value or "").strip()
    if not text:
        return None
    for key, week in CHINESE_WEEK_NUMBERS.items():
        if key in text:
            return week
    match = re.search(r"\d+", text)
    if match:
        week = int(match.group(0))
        if 1 <= week <= MAX_RENEWAL_WEEK_COUNT:
            return week
    return None


def clean_upload_note(value):
    text = str(value or "").strip()
    if not text:
        return ""
    table_markers = ["学员姓名", "学员账号", "平均完课", "跟进时间", "跟进情况", "是否报名"]
    marker_count = sum(1 for marker in table_markers if marker in text)
    if marker_count >= 3:
        return ""
    return text[:500]


def normalize_upload_blocker(value, store):
    option = normalize_blocker_option(value)
    if not option:
        return ""
    if option not in blocker_options(store):
        custom_options = [
            normalize_blocker_option(item)
            for item in store.get("blocker_options", [])
            if normalize_blocker_option(item)
        ]
        custom_options.append(option)
        store["blocker_options"] = list(dict.fromkeys(custom_options))
    return option


def upload_class_match_keys(item):
    keys = set()
    for value in (item.get("name"), item.get("note")):
        normalized = normalize_match_text(value)
        if normalized:
            keys.add(normalized)
    return keys


def find_upload_class(classes_by_id, class_name, teacher_id=""):
    class_key = normalize_match_text(class_name)
    if not class_key:
        return None, "缺少班级名称"
    candidates = [
        item
        for item in classes_by_id.values()
        if class_key in upload_class_match_keys(item)
    ]
    if teacher_id:
        teacher_matches = [item for item in candidates if class_teacher_id(item) == teacher_id]
        if teacher_matches:
            candidates = teacher_matches
    if len(candidates) == 1:
        return candidates[0], ""
    if not candidates:
        return None, "没有在完课班级中匹配到班级"
    return None, "匹配到多个同名班级，请补充班主任"


def find_student_for_upload(source_class, account, _name):
    account_key = normalize_match_text(account)
    # Names are display-only and may be changed by either side. Keep the
    # legacy branch disabled so historical imports also use account identity.
    name_key = ""
    students = source_class.get("students", [])
    if account_key:
        for student in students:
            student_account = student.get("account") or student.get("phone")
            if normalize_match_text(student_account) == account_key:
                return student, ""
    if name_key:
        matches = [
            student
            for student in students
            if normalize_match_text(student.get("name")) == name_key
        ]
        if len(matches) == 1:
            return matches[0], ""
        if len(matches) > 1:
            return None, "匹配到多个同名学员，请填写学员账号"
    return None, "没有在班级中匹配到学员"


def ensure_upload_project(store, source_class, stage):
    class_id = source_class.get("id")
    existing = next(
        (project for project in store.get("projects", []) if project.get("class_id") == class_id),
        None,
    )
    if existing:
        return existing, False

    teacher_id = class_teacher_id(source_class)
    project = {
        "id": uuid.uuid4().hex,
        "class_id": class_id,
        "class_name": source_class.get("name", ""),
        "owner": source_class.get("owner", current_owner()),
        "teacher_id": teacher_id,
        "stage": stage or RENEWAL_STAGES[0],
        "locked_student_count": source_class_student_count(source_class),
        "student_count_note": "",
        "student_snapshot": source_class_student_snapshots(source_class),
        "student_followups": {},
        "note": "",
        "created_by": current_owner(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    store.setdefault("projects", []).append(project)
    return project, True


def skipped_upload_label(record):
    location = str(record.get("_sheet_name") or "").strip()
    row_number = record.get("_row_number")
    if location and row_number:
        return f"{location} 第{row_number}行"
    if row_number:
        return f"第{row_number}行"
    return "未知行"


def blocker_priority(value):
    blocker = str(value or "").strip()
    if not blocker:
        return (1, len(BLOCKER_OPTIONS), "")
    try:
        option_index = BLOCKER_OPTIONS.index(blocker)
    except ValueError:
        option_index = len(BLOCKER_OPTIONS)
    return (0, option_index, blocker)


def completion_sort_value(value):
    try:
        return -float(value)
    except (TypeError, ValueError):
        return 1


def student_priority_key(student):
    status = student.get("followup_status") or ""
    priority = student.get("followup_priority") or ""
    blocker_bucket, blocker_index, blocker = blocker_priority(student.get("current_blocker"))
    return (
        completion_sort_value(student.get("average_completion")),
        FOLLOWUP_PRIORITY_RANK.get(priority, FOLLOWUP_PRIORITY_RANK[""]),
        FOLLOWUP_STATUS_PRIORITY.get(status, FOLLOWUP_STATUS_PRIORITY[""]),
        blocker_bucket,
        blocker_index,
        blocker,
        str(student.get("name") or ""),
        str(student.get("account") or ""),
    )


def student_prep_priority_key(student):
    status = student.get("followup_status") or ""
    priority = student.get("followup_priority") or ""
    return (
        completion_sort_value(student.get("average_completion")),
        FOLLOWUP_PRIORITY_RANK.get(priority, FOLLOWUP_PRIORITY_RANK[""]),
        FOLLOWUP_STATUS_PRIORITY.get(status, FOLLOWUP_STATUS_PRIORITY[""]),
        str(student.get("name") or ""),
        str(student.get("account") or ""),
    )


def serialize_source_class(item):
    teacher_id = class_teacher_id(item)
    return {
        "id": item.get("id", ""),
        "name": item.get("name", ""),
        "note": str(item.get("note") or "").strip(),
        "owner": item.get("owner", ""),
        "teacher_id": teacher_id,
        "teacher_name": teacher_label(teacher_id),
        "student_count": len(item.get("students", [])),
        "completion_activity": bool(item.get("completion_activity")),
    }


def leader_plan_counts(project, source_class=None):
    total = 0
    pending = 0
    for student_id, record in (project.get("student_followups") or {}).items():
        if not isinstance(record, dict):
            continue
        has_plan = bool(
            str(record.get("leader_note") or "").strip()
            or str(record.get("leader_talk_text") or "").strip()
            or normalize_leader_action_type(record.get("leader_action_type")) == "去电"
        )
        if not has_plan:
            continue
        total += 1
        if not bool(record.get("leader_note_done")):
            pending += 1
    return {
        "leader_plan_count": total,
        "pending_leader_plan_count": pending,
    }


def date_matches_today(value, today=None):
    text = str(value or "").strip()
    if not text:
        return False
    return text[:10] == (today or today_key())


def followup_record_touched_today(record, today=None):
    today = today or today_key()
    if not isinstance(record, dict):
        return False
    if date_matches_today(record.get("followed_at"), today):
        return True
    weekly_followups = record.get("weekly_followups")
    if isinstance(weekly_followups, dict):
        for week_records in weekly_followups.values():
            if not isinstance(week_records, list):
                continue
            for item in week_records:
                if not isinstance(item, dict):
                    continue
                if date_matches_today(item.get("date"), today) or date_matches_today(item.get("created_at") or item.get("createdAt"), today):
                    return True
    general_followups = record.get("general_followups")
    if isinstance(general_followups, list):
        for item in general_followups:
            if not isinstance(item, dict):
                continue
            if date_matches_today(item.get("date"), today) or date_matches_today(item.get("created_at") or item.get("createdAt"), today):
                return True
    for item in normalize_note_entries(record):
        if date_matches_today(item.get("created_at"), today) or date_matches_today(item.get("updated_at"), today):
            return True
    return False


def followup_date_for_request(value=None):
    return normalize_followup_date(value or today_key())


def merge_followup_methods(target, methods):
    for method in normalize_followup_methods(methods):
        if method not in target:
            target.append(method)


def latest_followup_value(values):
    cleaned = [str(value or "").strip() for value in values if str(value or "").strip()]
    return max(cleaned) if cleaned else ""


def followup_action_summary(record, target_date):
    if not isinstance(record, dict):
        return None
    methods = []
    sources = []
    latest_values = []
    note_texts = []

    def add_source(label):
        if label and label not in sources:
            sources.append(label)

    weekly_followups = normalize_weekly_followups(record.get("weekly_followups"))
    for week_key, week_records in weekly_followups.items():
        for item in week_records:
            if date_matches_today(item.get("date"), target_date) or date_matches_today(item.get("created_at"), target_date):
                merge_followup_methods(methods, item.get("methods"))
                add_source(f"第{week_key}周")
                latest_values.append(item.get("created_at") or item.get("date"))

    for item in normalize_general_followups(record.get("general_followups")):
        if date_matches_today(item.get("date"), target_date) or date_matches_today(item.get("created_at"), target_date):
            merge_followup_methods(methods, item.get("methods"))
            add_source("跟进记录")
            latest_values.append(item.get("created_at") or item.get("date"))

    for item in normalize_note_entries(record):
        if date_matches_today(item.get("created_at"), target_date) or date_matches_today(item.get("updated_at"), target_date):
            text = str(item.get("text") or "").strip()
            if text:
                note_texts.append(text)
            latest_values.append(item.get("updated_at") or item.get("created_at"))

    if date_matches_today(record.get("leader_note_done_at"), target_date):
        add_source("盘单完成")
        latest_values.append(record.get("leader_note_done_at"))

    if date_matches_today(record.get("followed_at"), target_date):
        add_source("已跟进")
        latest_values.append(record.get("followed_at"))

    if not methods and not sources and not note_texts:
        return None

    latest_at = latest_followup_value(latest_values)
    return {
        "methods": methods,
        "sources": sources,
        "latest_at": latest_at,
        "latest_time": format_followup_time(latest_at),
        "note": note_texts[-1][:120] if note_texts else "",
    }


def renewal_followup_overview(projects, classes_by_id, target_date=None):
    date_key = followup_date_for_request(target_date)
    teachers = {}
    total_student_count = 0
    total_project_ids = set()

    for project in projects:
        source_class = classes_by_id.get(project.get("class_id"))
        teacher_id = (
            normalize_teacher_id(project.get("teacher_id"))
            or (class_teacher_id(source_class) if source_class else "")
        )
        teacher_name = teacher_label(teacher_id)
        teacher_entry = teachers.setdefault(teacher_id or project.get("owner", ""), {
            "teacher_id": teacher_id,
            "teacher_name": teacher_name,
            "student_count": 0,
            "project_count": 0,
            "pending_leader_plan_count": 0,
            "rows": [],
            "_project_ids": set(),
        })
        teacher_entry["pending_leader_plan_count"] += int(leader_plan_counts(project, source_class).get("pending_leader_plan_count") or 0)

        for student in project_student_rows(project, source_class):
            student_id = str(student.get("id") or "").strip()
            if not student_id:
                continue
            record = (project.get("student_followups") or {}).get(student_id)
            summary = followup_action_summary(record, date_key)
            if not summary:
                continue
            teacher_entry["rows"].append({
                "project_id": project.get("id", ""),
                "class_name": source_class.get("name", project.get("class_name", "")) if source_class else project.get("class_name", ""),
                "stage": normalize_stage(project.get("stage")),
                "student_id": student_id,
                "student_name": str(student.get("name") or student.get("account") or "未命名学员").strip(),
                "current_blocker": normalize_blocker(record.get("current_blocker")),
                "methods": summary.get("methods", []),
                "sources": summary.get("sources", []),
                "latest_at": summary.get("latest_at", ""),
                "latest_time": summary.get("latest_time", ""),
                "note": summary.get("note", ""),
            })
            teacher_entry["student_count"] += 1
            teacher_entry["_project_ids"].add(project.get("id", ""))
            total_student_count += 1
            total_project_ids.add(project.get("id", ""))

    output_teachers = []
    for teacher in teachers.values():
        teacher["rows"].sort(key=lambda item: (item.get("latest_at", ""), item.get("class_name", ""), item.get("student_name", "")), reverse=True)
        teacher["project_count"] = len([item for item in teacher["_project_ids"] if item])
        teacher.pop("_project_ids", None)
        output_teachers.append(teacher)

    output_teachers.sort(key=lambda item: (-int(item.get("student_count") or 0), item.get("teacher_name") or item.get("teacher_id") or ""))
    return {
        "date": date_key,
        "date_label": format_followup_date(date_key),
        "teacher_count": len([item for item in output_teachers if item.get("student_count")]),
        "project_count": len([item for item in total_project_ids if item]),
        "student_count": total_student_count,
        "teachers": output_teachers,
    }


def project_today_followup_count(project, source_class=None):
    total = 0
    for student_id, record in (project.get("student_followups") or {}).items():
        if followup_record_touched_today(record):
            total += 1
    return total


def renewal_snapshot_student(source_student, month_key=None):
    if not isinstance(source_student, dict):
        return None
    student_id = str(source_student.get("id") or "").strip()
    if not student_id:
        return None
    month = month_key or renewal_completion_month_key()
    return {
        "id": student_id,
        "name": str(source_student.get("name") or "").strip(),
        "account": str(source_student.get("account") or source_student.get("phone") or "").strip(),
        "average_completion": calculate_monthly_completion(get_student_weeks(source_student, month)),
    }


def source_class_student_snapshots(source_class, month_key=None):
    if not source_class:
        return []
    snapshots = []
    for student in source_class.get("students", []):
        snapshot = renewal_snapshot_student(student, month_key)
        if snapshot:
            snapshots.append(snapshot)
    return snapshots


def normalize_project_student_snapshot(project):
    raw_items = project.get("student_snapshot")
    if not isinstance(raw_items, list):
        raw_items = project.get("students_snapshot")
    if not isinstance(raw_items, list):
        return []
    normalized = []
    seen = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        student_id = str(item.get("id") or item.get("student_id") or "").strip()
        if not student_id or student_id in seen:
            continue
        seen.add(student_id)
        normalized.append({
            "id": student_id,
            "name": str(item.get("name") or "").strip(),
            "account": str(item.get("account") or item.get("phone") or "").strip(),
            "average_completion": item.get("average_completion"),
        })
    return normalized


def ensure_project_student_snapshot(project, source_class):
    current_snapshots = normalize_project_student_snapshot(project)
    snapshots_by_id = {
        str(item.get("id") or ""): dict(item)
        for item in current_snapshots
        if str(item.get("id") or "").strip()
    }
    ordered_ids = [str(item.get("id") or "") for item in current_snapshots if str(item.get("id") or "").strip()]
    changed = "student_snapshot" not in project or project.get("student_snapshot") != current_snapshots

    if source_class:
        for source_snapshot in source_class_student_snapshots(source_class):
            student_id = str(source_snapshot.get("id") or "").strip()
            if not student_id:
                continue
            target = snapshots_by_id.get(student_id)
            if target is None:
                snapshots_by_id[student_id] = dict(source_snapshot)
                ordered_ids.append(student_id)
                changed = True
                continue

            for key in ("name", "account", "average_completion"):
                if target.get(key) != source_snapshot.get(key):
                    target[key] = source_snapshot.get(key)
                    changed = True

    next_snapshots = [snapshots_by_id[student_id] for student_id in ordered_ids if student_id in snapshots_by_id]
    if changed or project.get("student_snapshot") != next_snapshots:
        project["student_snapshot"] = next_snapshots
        project["snapshot_updated_at"] = now_iso()
        return True
    return False


def project_student_rows(project, source_class=None):
    rows = normalize_project_student_snapshot(project)
    if not rows and source_class:
        rows = source_class_student_snapshots(source_class)
    seen = {str(item.get("id") or "") for item in rows if item.get("id")}
    for student_id, record in (project.get("student_followups") or {}).items():
        student_key = str(student_id or "").strip()
        if not student_key or student_key in seen:
            continue
        if not isinstance(record, dict):
            continue
        rows.append({
            "id": student_key,
            "name": str(record.get("student_name") or "").strip(),
            "account": str(record.get("student_account") or "").strip(),
            "average_completion": record.get("average_completion"),
        })
        seen.add(student_key)
    return rows


LEGACY_FOLLOWUP_COMPLETION_THRESHOLD = 30


def normalize_legacy_followup_student(value):
    if not isinstance(value, dict):
        return None
    student_id = str(value.get("id") or value.get("student_id") or "").strip()
    if not student_id:
        return None
    output = {
        "id": student_id,
        "name": str(value.get("name") or "").strip()[:80],
        "account": str(value.get("account") or value.get("phone") or "").strip()[:120],
        "average_completion": value.get("average_completion"),
    }
    if "current_blocker" in value:
        output["current_blocker"] = str(value.get("current_blocker") or "").strip()[:100]
    if "judgement" in value:
        output["judgement"] = str(value.get("judgement") or "").strip()[:500]
    return output


def legacy_followup_students(legacy_list):
    raw_students = legacy_list.get("students") if isinstance(legacy_list, dict) else []
    if not isinstance(raw_students, list):
        return []
    students = []
    seen = set()
    for item in raw_students:
        student = normalize_legacy_followup_student(item)
        if student is None or student["id"] in seen:
            continue
        students.append(student)
        seen.add(student["id"])
    return students


def find_legacy_followup_list(store, legacy_list_id):
    target_id = str(legacy_list_id or "").strip()
    return next(
        (
            item
            for item in store.get("legacy_followups", [])
            if isinstance(item, dict) and str(item.get("id") or "") == target_id
        ),
        None,
    )


def can_edit_legacy_followup(legacy_list):
    return can_manage_accounts() or legacy_list.get("owner") == current_owner()


def legacy_followup_student_snapshot(student):
    return {
        "id": str(student.get("id") or "").strip(),
        "name": str(student.get("name") or "").strip()[:80],
        "account": str(student.get("account") or student.get("phone") or "").strip()[:120],
        "average_completion": student.get("average_completion"),
    }


def legacy_completion_above_threshold(student, threshold=LEGACY_FOLLOWUP_COMPLETION_THRESHOLD):
    try:
        return float(student.get("average_completion")) > threshold
    except (TypeError, ValueError):
        return False


def legacy_followup_default_judgement(record):
    notes = normalize_note_entries(record) if isinstance(record, dict) else []
    if notes:
        return str(notes[-1].get("text") or "").strip()
    return normalize_followup_status((record or {}).get("status"))


def serialize_legacy_followup_list(legacy_list, projects_by_id, classes_by_id, store):
    project = projects_by_id.get(legacy_list.get("project_id"))
    source_class = classes_by_id.get(project.get("class_id")) if project else None
    source_rows = project_student_rows(project, source_class) if project else []
    source_by_id = {
        str(student.get("id") or ""): student
        for student in source_rows
        if str(student.get("id") or "").strip()
    }
    followups = project.get("student_followups") if isinstance(project, dict) and isinstance(project.get("student_followups"), dict) else {}
    stored_students = legacy_followup_students(legacy_list)
    selected_ids = {student["id"] for student in stored_students}
    students = []

    for stored_student in stored_students:
        student_id = stored_student["id"]
        source_student = source_by_id.get(student_id, {})
        followup = followups.get(student_id) if isinstance(followups.get(student_id), dict) else {}
        source_blocker = normalize_blocker(followup.get("current_blocker"), store)
        source_judgement = legacy_followup_default_judgement(followup)
        source_completion = source_student.get("average_completion")
        students.append({
            "id": student_id,
            "name": str(source_student.get("name") or stored_student.get("name") or "").strip(),
            "account": str(source_student.get("account") or stored_student.get("account") or "").strip(),
            "average_completion": source_completion if source_completion is not None else stored_student.get("average_completion"),
            "current_blocker": stored_student.get("current_blocker") if "current_blocker" in stored_student else source_blocker,
            "judgement": stored_student.get("judgement") if "judgement" in stored_student else source_judgement,
            "has_current_blocker_override": "current_blocker" in stored_student,
            "has_judgement_override": "judgement" in stored_student,
        })

    candidates = [
        legacy_followup_student_snapshot(student)
        for student in source_rows
        if str(student.get("id") or "").strip() not in selected_ids
    ]
    candidates.sort(key=lambda item: (str(item.get("name") or ""), str(item.get("account") or "")))
    teacher_id = (
        class_teacher_id(source_class)
        if source_class
        else normalize_teacher_id((project or {}).get("teacher_id") or legacy_list.get("teacher_id"))
    )
    class_name = (
        str((source_class or {}).get("name") or "").strip()
        or str((project or {}).get("class_name") or "").strip()
        or str(legacy_list.get("class_name") or "").strip()
    )
    return {
        "id": str(legacy_list.get("id") or ""),
        "project_id": str(legacy_list.get("project_id") or ""),
        "class_id": str((project or {}).get("class_id") or legacy_list.get("class_id") or ""),
        "class_name": class_name,
        "teacher_id": teacher_id,
        "teacher_name": teacher_label(teacher_id),
        "stage": normalize_stage((project or {}).get("stage")),
        "class_missing": project is None,
        "can_edit": can_edit_legacy_followup(legacy_list),
        "can_remove_class": can_manage_accounts(),
        "students": students,
        "available_students": candidates,
        "student_count": len(students),
        "created_at": str(legacy_list.get("created_at") or ""),
        "updated_at": str(legacy_list.get("updated_at") or ""),
    }


def serialize_legacy_followups(store, classes_by_id):
    projects_by_id = {
        str(project.get("id") or ""): project
        for project in store.get("projects", [])
        if str(project.get("id") or "").strip()
    }
    legacy_lists = [
        serialize_legacy_followup_list(legacy_list, projects_by_id, classes_by_id, store)
        for legacy_list in store.get("legacy_followups", [])
        if isinstance(legacy_list, dict) and can_edit_legacy_followup(legacy_list)
    ]
    legacy_lists.sort(key=lambda item: (item.get("teacher_name") or "", item.get("class_name") or ""))
    return legacy_lists


def legacy_followup_available_projects(store, classes_by_id):
    tracked_ids = {
        str(item.get("project_id") or "")
        for item in store.get("legacy_followups", [])
        if isinstance(item, dict) and str(item.get("project_id") or "").strip()
    }
    projects = []
    for project in store.get("projects", []):
        project_id = str(project.get("id") or "").strip()
        if not project_id or project_id in tracked_ids:
            continue
        source_class = classes_by_id.get(project.get("class_id"))
        teacher_id = class_teacher_id(source_class) if source_class else normalize_teacher_id(project.get("teacher_id"))
        projects.append({
            "id": project_id,
            "class_name": str((source_class or {}).get("name") or project.get("class_name") or "").strip(),
            "teacher_name": teacher_label(teacher_id),
            "stage": normalize_stage(project.get("stage")),
        })
    return sorted(projects, key=lambda item: (item.get("teacher_name") or "", item.get("class_name") or ""))


def find_project_snapshot_student(project, student_id):
    target_id = str(student_id or "").strip()
    for item in normalize_project_student_snapshot(project):
        if str(item.get("id") or "") == target_id:
            return item
    return None


def update_project_snapshot_student(project, student_id, changes):
    target_id = str(student_id or "").strip()
    if not target_id:
        return False
    snapshots = normalize_project_student_snapshot(project)
    changed = False
    target = next((item for item in snapshots if str(item.get("id") or "") == target_id), None)
    if target is None:
        target = {"id": target_id, "name": "", "account": "", "average_completion": None}
        snapshots.append(target)
        changed = True
    for key, value in changes.items():
        if target.get(key) != value:
            target[key] = value
            changed = True
    if changed:
        project["student_snapshot"] = snapshots
        project["snapshot_updated_at"] = now_iso()
    return changed


def renewal_intent_summary(project, source_class=None):
    summary = {
        "student_count": 0,
        "completion_over_60_count": 0,
        "status_counts": {status: 0 for status in FOLLOWUP_STATUSES},
        "priority_counts": {priority: 0 for priority in FOLLOWUP_PRIORITIES},
        "enrolled_count": 0,
    }
    followups = project.get("student_followups") if isinstance(project.get("student_followups"), dict) else {}
    rows = project_student_rows(project, source_class)

    for student in rows:
        student_id = str(student.get("id") or "")
        if not student_id:
            continue
        summary["student_count"] += 1
        try:
            average_completion = float(student.get("average_completion") or 0)
        except (TypeError, ValueError):
            average_completion = 0
        if average_completion >= 60:
            summary["completion_over_60_count"] += 1
        record = followups.get(student_id) if isinstance(followups.get(student_id), dict) else {}
        status = normalize_followup_status(record.get("status"))
        priority = normalize_followup_priority(record.get("priority"))
        if status:
            summary["status_counts"][status] += 1
        if priority:
            summary["priority_counts"][priority] += 1
        if bool(record.get("enrolled")):
            summary["enrolled_count"] += 1
    return summary


def serialize_project(project, classes_by_id):
    source_class = classes_by_id.get(project.get("class_id"))
    source_count = source_class_student_count(source_class)
    locked_count = project_student_count(project, source_class)
    teacher_id = (
        normalize_teacher_id(project.get("teacher_id"))
        or (class_teacher_id(source_class) if source_class else "")
    )
    output = {
        "id": project.get("id", ""),
        "class_id": project.get("class_id", ""),
        "class_name": project.get("class_name", ""),
        "class_note": "",
        "class_missing": source_class is None,
        "owner": project.get("owner", ""),
        "teacher_id": teacher_id,
        "teacher_name": teacher_label(teacher_id),
        "student_count": locked_count,
        "source_student_count": source_count,
        "student_count_note": str(project.get("student_count_note") or "").strip(),
        "closing_month": normalize_closing_month(project.get("closing_month")),
        "completion_activity": False,
        "stage": normalize_stage(project.get("stage")),
        "note": str(project.get("note") or "").strip(),
        "can_edit": can_edit_project(project),
        "can_manage_closing_month": can_manage_accounts(),
        "created_at": project.get("created_at", ""),
        "updated_at": project.get("updated_at", ""),
    }
    if source_class:
        output.update({
            "class_name": source_class.get("name", output["class_name"]),
            "class_note": str(source_class.get("note") or "").strip(),
            "source_student_count": source_count,
            "completion_activity": bool(source_class.get("completion_activity")),
            "owner": source_class.get("owner", output["owner"]),
            "teacher_id": class_teacher_id(source_class),
            "teacher_name": teacher_label(class_teacher_id(source_class)),
        })
    student_count, checked_enrolled_count, manual_enrolled_count, enrolled_count = project_enrollment_counts(
        project,
        source_class,
    )
    (
        detected_month_enrolled_count,
        manual_month_enrolled_count,
        month_enrolled_count,
        historical_enrolled_count,
    ) = project_enrollment_breakdown(project, enrolled_count, source_class)
    target_count = None if output["stage"] == RENEWAL_STAGES[0] else project_month_target(project)
    output["checked_enrolled_count"] = checked_enrolled_count
    output["manual_enrolled_count"] = manual_enrolled_count
    output["enrolled_count_overridden"] = manual_enrolled_count is not None
    output["enrolled_count"] = enrolled_count
    output["detected_month_enrolled_count"] = detected_month_enrolled_count
    output["manual_month_enrolled_count"] = manual_month_enrolled_count
    output["month_enrolled_count_overridden"] = manual_month_enrolled_count is not None
    output["month_enrolled_count"] = month_enrolled_count
    output["historical_enrolled_count"] = historical_enrolled_count
    output["renewal_rate"] = round(enrolled_count / student_count * 100, 2) if student_count else None
    output["target_count"] = target_count
    output["target_gap"] = max(0, target_count - month_enrolled_count) if target_count is not None else None
    output["target_progress_rate"] = round(month_enrolled_count / target_count * 100, 2) if target_count else None
    output["target_month"] = current_period_label()
    output["followup_week_count"] = renewal_week_count()
    output["followup_week_options"] = renewal_week_options()
    output["today_followup_count"] = project_today_followup_count(project, source_class)
    output["intent_summary"] = renewal_intent_summary(project, source_class)
    output["intent_summary"]["enrolled_count"] = enrolled_count
    output.update(leader_plan_counts(project, source_class))
    return output


def serialize_project_detail(project, classes_by_id):
    output = serialize_project(project, classes_by_id)
    source_class = classes_by_id.get(project.get("class_id"))
    month_key = renewal_completion_month_key()
    output["completion_month"] = month_key
    output["completion_label"] = f"{int(month_key[5:7])}月完课"
    include_weekly_in_general = output.get("stage") in RENEWAL_SINGLE_FOLLOWUP_STAGES
    output["students"] = []
    students = []
    for student in project_student_rows(project, source_class):
        student_id = str(student.get("id") or "")
        if not student_id:
            continue
        followup = student_followup_record(project, student_id)
        students.append({
            "id": student_id,
            "name": str(student.get("name") or "").strip(),
            "account": str(student.get("account") or "").strip(),
            "average_completion": student.get("average_completion"),
            "followup_time": format_followup_time(followup.get("followed_at")),
            "followup_status": normalize_followup_status(followup.get("status")),
            "followup_priority": normalize_followup_priority(followup.get("priority")),
            "current_blocker": normalize_blocker(followup.get("current_blocker")),
            "weekly_followups": serialize_weekly_followups(followup),
            "general_followup": serialize_general_followups(followup, include_weekly=include_weekly_in_general),
            "enrolled": bool(followup.get("enrolled")),
            "followup_note": note_history_text(followup),
            "followup_notes": normalize_note_entries(followup),
            "leader_action_type": normalize_leader_action_type(followup.get("leader_action_type")),
            "leader_note": str(followup.get("leader_note") or "").strip(),
            "leader_talk_keyword": str(followup.get("leader_talk_keyword") or "").strip(),
            "leader_talk_type": str(followup.get("leader_talk_type") or "").strip(),
            "leader_talk_title": str(followup.get("leader_talk_title") or "").strip(),
            "leader_talk_text": str(followup.get("leader_talk_text") or "").strip(),
            "leader_note_done": bool(followup.get("leader_note_done")),
            "leader_note_updated_at": format_followup_time(followup.get("leader_note_updated_at")),
            "leader_note_done_at": format_followup_time(followup.get("leader_note_done_at")),
        })
    if output.get("stage") in RENEWAL_PRIORITY_STAGES:
        students.sort(key=student_priority_key)
    elif output.get("stage") == RENEWAL_STAGES[0]:
        students.sort(key=student_prep_priority_key)
    output["students"] = students
    return output


def visible_projects(store):
    if can_manage_accounts():
        return store.get("projects", [])
    owner = current_owner()
    return [project for project in store.get("projects", []) if project.get("owner") == owner]


def project_summary(projects):
    counts = {stage: 0 for stage in RENEWAL_STAGES}
    target_projects = 0
    target_total = 0
    target_progress_total = 0
    month_enrolled_total = 0
    enrolled_total = 0
    for project in projects:
        counts[normalize_stage(project.get("stage"))] += 1
        month_enrolled_total += int(project.get("month_enrolled_count") or 0)
        enrolled_total += int(project.get("enrolled_count") or 0)
        target_count = normalize_target_count(project.get("target_count"))
        if target_count is not None:
            target_projects += 1
            target_total += target_count
            target_progress_total += int(project.get("month_enrolled_count") or 0)
    return {
        "total": len(projects),
        "stage_counts": counts,
        "target_projects": target_projects,
        "target_count": target_total,
        "target_new_enrolled_count": target_progress_total,
        "month_enrolled_count": month_enrolled_total,
        "enrolled_count": enrolled_total,
        "target_gap": max(0, target_total - target_progress_total) if target_projects else None,
        "target_progress_rate": round(target_progress_total / target_total * 100, 2) if target_total else None,
        "target_month": current_period_label(),
    }


def teacher_overview(projects, classes_by_id):
    if not can_manage_accounts():
        return []
    teachers = {}
    for item in classes_by_id.values():
        teacher_id = class_teacher_id(item)
        if not teacher_id:
            continue
        entry = teachers.setdefault(teacher_id, {
            "teacher_id": teacher_id,
            "teacher_name": teacher_label(teacher_id),
            "class_count": 0,
            "project_count": 0,
            "student_count": 0,
            "enrolled_count": 0,
            "pending_leader_plan_count": 0,
            "stage_counts": {stage: 0 for stage in RENEWAL_STAGES},
            "today_followup_count": 0,
            "projects": [],
        })
        entry["class_count"] += 1
    for project in projects:
        teacher_id = normalize_teacher_id(project.get("teacher_id"))
        if not teacher_id:
            continue
        entry = teachers.setdefault(teacher_id, {
            "teacher_id": teacher_id,
            "teacher_name": teacher_label(teacher_id),
            "class_count": 0,
            "project_count": 0,
            "student_count": 0,
            "enrolled_count": 0,
            "pending_leader_plan_count": 0,
            "stage_counts": {stage: 0 for stage in RENEWAL_STAGES},
            "today_followup_count": 0,
            "projects": [],
        })
        entry["teacher_name"] = project.get("teacher_name") or entry["teacher_name"]
        entry["project_count"] += 1
        entry["student_count"] += int(project.get("student_count") or 0)
        entry["enrolled_count"] += int(project.get("enrolled_count") or 0)
        entry["target_count"] = int(entry.get("target_count") or 0) + int(project.get("target_count") or 0)
        entry["pending_leader_plan_count"] += int(project.get("pending_leader_plan_count") or 0)
        entry["today_followup_count"] += int(project.get("today_followup_count") or 0)
        entry["stage_counts"][normalize_stage(project.get("stage"))] += 1
        entry["projects"].append({
            "id": project.get("id", ""),
            "class_name": project.get("class_name", ""),
            "class_note": project.get("class_note", ""),
            "stage": normalize_stage(project.get("stage")),
            "today_followup_count": int(project.get("today_followup_count") or 0),
        })
    for entry in teachers.values():
        entry["projects"].sort(key=lambda item: (RENEWAL_STAGES.index(item["stage"]), item.get("class_name", "")))
    return sorted(
        teachers.values(),
        key=lambda item: (item.get("teacher_name", ""), item.get("teacher_id", "")),
    )


def refresh_project_snapshots(store, classes_by_id):
    changed = prune_store_followups(store, classes_by_id)
    for project in store.get("projects", []):
        source_class = classes_by_id.get(project.get("class_id"))
        changed = ensure_project_student_count_lock(
            project,
            source_class,
        ) or changed
        changed = ensure_project_student_snapshot(project, source_class) or changed
    return changed


def preparation_export_percent(value):
    try:
        return round(float(value) / 100, 4)
    except (TypeError, ValueError):
        return None


def style_preparation_export_sheet(worksheet, headers, column_widths, percentage_columns=()):
    header_fill = PatternFill("solid", fgColor="DCEBFF")
    header_font = Font(color="17395D", bold=True)
    thin_border = Border(
        left=Side(style="thin", color="D7E2EF"),
        right=Side(style="thin", color="D7E2EF"),
        top=Side(style="thin", color="D7E2EF"),
        bottom=Side(style="thin", color="D7E2EF"),
    )
    worksheet.freeze_panes = "A2"
    worksheet.sheet_view.showGridLines = False
    worksheet.auto_filter.ref = f"A1:{get_column_letter(len(headers))}{max(worksheet.max_row, 1)}"
    worksheet.row_dimensions[1].height = 26

    for index, header in enumerate(headers, start=1):
        cell = worksheet.cell(1, index)
        cell.value = header
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = thin_border
        worksheet.column_dimensions[get_column_letter(index)].width = column_widths[index - 1]

    for row in worksheet.iter_rows(min_row=2, max_row=worksheet.max_row, max_col=len(headers)):
        for cell in row:
            cell.border = thin_border
            cell.alignment = Alignment(vertical="top", wrap_text=True)
        for column_index in percentage_columns:
            row[column_index - 1].number_format = "0.00%"


def build_preparation_export_workbook(projects, classes_by_id, store):
    workbook = Workbook()
    class_sheet = workbook.active
    class_sheet.title = "铺垫班级汇总"
    class_headers = [
        "班主任",
        "班级名称",
        "班级备注",
        "班级人数",
        "已报名人数",
        "本月新增报名",
        "历史已报名",
        "续费率",
        "已录入学员数",
        "最近更新时间",
    ]
    class_sheet.append(class_headers)

    detail_sheet = workbook.create_sheet("铺垫学员明细")
    detail_headers = [
        "班主任",
        "班级名称",
        "学员姓名",
        "学习账号",
        "上月平均完课率",
        "铺垫情况",
        "意向度",
        "当前卡点",
        "是否报名",
        "最近跟进时间",
        "最近跟进方式",
        "跟进次数",
        "备注",
    ]
    detail_sheet.append(detail_headers)

    serialized_projects = [
        (project, serialize_project(project, classes_by_id))
        for project in projects
    ]
    serialized_projects.sort(
        key=lambda item: (
            item[1].get("teacher_name", ""),
            item[1].get("class_name", ""),
        )
    )

    for project, summary in serialized_projects:
        class_sheet.append([
            summary.get("teacher_name", ""),
            summary.get("class_name", ""),
            summary.get("class_note", ""),
            int(summary.get("student_count") or 0),
            int(summary.get("enrolled_count") or 0),
            int(summary.get("month_enrolled_count") or 0),
            int(summary.get("historical_enrolled_count") or 0),
            preparation_export_percent(summary.get("renewal_rate")),
            len(project_student_rows(project, classes_by_id.get(project.get("class_id")))),
            format_followup_time(summary.get("updated_at")),
        ])

        source_class = classes_by_id.get(project.get("class_id"))
        detail_rows = []
        for student in project_student_rows(project, source_class):
            student_id = str(student.get("id") or "").strip()
            if not student_id:
                continue
            followup = (project.get("student_followups") or {}).get(student_id)
            followup = followup if isinstance(followup, dict) else {}
            general_followup = serialize_general_followups(followup, include_weekly=True)
            detail_rows.append({
                "teacher_name": summary.get("teacher_name", ""),
                "class_name": summary.get("class_name", ""),
                "name": str(student.get("name") or "").strip(),
                "account": str(student.get("account") or "").strip(),
                "average_completion": student.get("average_completion"),
                "followup_status": normalize_followup_status(followup.get("status")),
                "followup_priority": normalize_followup_priority(followup.get("priority")),
                "current_blocker": normalize_blocker(followup.get("current_blocker"), store),
                "enrolled": bool(followup.get("enrolled")),
                "followup_time": format_followup_time(followup.get("followed_at")),
                "latest_methods": "、".join(general_followup.get("latest_methods", [])),
                "followup_count": int(general_followup.get("count") or 0),
                "followup_note": note_history_text(followup),
            })

        detail_rows.sort(key=student_prep_priority_key)
        for row in detail_rows:
            detail_sheet.append([
                row["teacher_name"],
                row["class_name"],
                row["name"],
                row["account"],
                preparation_export_percent(row["average_completion"]),
                row["followup_status"],
                row["followup_priority"],
                row["current_blocker"],
                "已报名" if row["enrolled"] else "未报名",
                row["followup_time"],
                row["latest_methods"],
                row["followup_count"],
                row["followup_note"],
            ])

    style_preparation_export_sheet(
        class_sheet,
        class_headers,
        [16, 34, 20, 12, 14, 14, 14, 12, 14, 20],
        percentage_columns=(8,),
    )
    style_preparation_export_sheet(
        detail_sheet,
        detail_headers,
        [16, 34, 14, 20, 16, 16, 16, 18, 12, 20, 18, 12, 54],
        percentage_columns=(5,),
    )
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def build_project_followup_export_workbook(project, classes_by_id):
    """Build the concise per-class follow-up export available to administrators."""
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "跟进明细"
    headers = ["姓名", "账号", "跟进情况", "顾虑", "备注"]
    worksheet.append(headers)

    detail = serialize_project_detail(project, classes_by_id)
    for student in detail.get("students", []):
        worksheet.append([
            str(student.get("name") or "").strip(),
            str(student.get("account") or "").strip(),
            str(student.get("followup_status") or "").strip(),
            str(student.get("current_blocker") or "").strip(),
            str(student.get("followup_note") or "").strip(),
        ])

    style_preparation_export_sheet(
        worksheet,
        headers,
        [16, 22, 16, 18, 56],
    )
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    return output


def renewal_export_filename_component(value):
    text = re.sub(r'[\\/:*?"<>|]+', "_", str(value or "").strip())
    return text.strip(" ._")[:80] or "未命名班级"


def build_payload(followup_date=None):
    store = load_store()
    classes_by_id = class_lookup()
    changed = refresh_project_snapshots(store, classes_by_id)
    if changed:
        save_store(store)
    projects = [
        serialize_project(project, classes_by_id)
        for project in visible_projects(store)
    ]
    visible_raw_projects = visible_projects(store)
    tracked_class_ids = {project.get("class_id") for project in store.get("projects", []) if project.get("class_id")}
    available_classes = [
        serialize_source_class(item)
        for item in classes_by_id.values()
        if can_add_class(item) and item.get("id") not in tracked_class_ids
    ]
    available_classes.sort(key=lambda item: (item.get("teacher_name", ""), item.get("name", "")))
    projects.sort(key=lambda item: (RENEWAL_STAGES.index(item["stage"]), item.get("teacher_name", ""), item.get("class_name", "")))
    legacy_followups = serialize_legacy_followups(store, classes_by_id)
    return {
        "stages": RENEWAL_STAGES,
        "followup_statuses": FOLLOWUP_STATUSES,
        "followup_priorities": FOLLOWUP_PRIORITIES,
        "followup_methods": FOLLOWUP_METHODS,
        "followup_week_count": renewal_week_count(),
        "followup_week_options": renewal_week_options(),
        "followup_period": renewal_followup_period(),
        "blocker_options": blocker_options(store),
        "projects": projects,
        "available_classes": available_classes,
        "summary": project_summary(projects),
        "teacher_overview": teacher_overview(projects, classes_by_id),
        "followup_overview": renewal_followup_overview(visible_raw_projects, classes_by_id, followup_date),
        "legacy_followups": legacy_followups,
        "legacy_available_projects": legacy_followup_available_projects(store, classes_by_id) if can_manage_accounts() else [],
        "can_manage_all": can_manage_accounts(),
        "current_teacher_id": current_teacher_id(),
    }


@renewal_bp.get("")
@login_required
def renewal_home():
    return jsonify(build_payload(request.args.get("followup_date")))


@renewal_bp.get("/exports/preparation")
@login_required
def export_preparation_projects():
    if not can_manage_accounts():
        return jsonify({"error": "只有管理员可以下载续费数据。"}), 403
    store = load_store()
    classes_by_id = class_lookup()
    if refresh_project_snapshots(store, classes_by_id):
        save_store(store)

    projects = [
        project
        for project in visible_projects(store)
        if normalize_stage(project.get("stage")) == RENEWAL_STAGES[0]
    ]
    if not projects:
        return jsonify({"error": "暂无可导出的铺垫阶段续费班级。"}), 404

    output = build_preparation_export_workbook(projects, classes_by_id, store)
    filename = f"续费铺垫班级数据_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@renewal_bp.get("/projects/<project_id>/export")
@login_required
def export_project_followups(project_id):
    if not can_manage_accounts():
        return jsonify({"error": "只有管理员可以下载班级跟进数据。"}), 403

    store = load_store()
    project = find_project(store, project_id)
    if project is None:
        return jsonify({"error": "续费项目不存在。"}), 404

    classes_by_id = class_lookup()
    output = build_project_followup_export_workbook(project, classes_by_id)
    class_name = renewal_export_filename_component(
        serialize_project(project, classes_by_id).get("class_name")
    )
    filename = f"续费跟进明细_{class_name}_{datetime.now().strftime('%Y%m%d')}.xlsx"
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@renewal_bp.post("/blockers")
@login_required
def create_blocker_option():
    if not can_manage_accounts():
        return jsonify({"error": "只有管理员可以新增当前卡点选项。"}), 403
    payload = request.get_json(silent=True) or {}
    option = normalize_blocker_option(payload.get("option"))
    if not option:
        return jsonify({"error": "请先填写要新增的当前卡点。"}), 400

    store = load_store()
    existing_options = blocker_options(store)
    if option not in existing_options:
        custom_options = [
            normalize_blocker_option(item)
            for item in store.get("blocker_options", [])
            if normalize_blocker_option(item)
        ]
        custom_options.append(option)
        store["blocker_options"] = list(dict.fromkeys(custom_options))
        save_store(store)
    return jsonify(build_payload()), 201


@renewal_bp.post("/projects")
@login_required
def create_project():
    payload = request.get_json(silent=True) or {}
    class_id = str(payload.get("class_id") or "").strip()
    if not class_id:
        return jsonify({"error": "请先选择要加入续费项目的班级。"}), 400

    classes_by_id = class_lookup()
    source_class = classes_by_id.get(class_id)
    if source_class is None or not can_add_class(source_class):
        return jsonify({"error": "只能添加完课-我的班级里的班级。"}), 404

    store = load_store()
    if any(project.get("class_id") == class_id for project in store.get("projects", [])):
        return jsonify({"error": "这个班级已经在续费项目里了。"}), 400

    teacher_id = class_teacher_id(source_class)
    project = {
        "id": uuid.uuid4().hex,
        "class_id": class_id,
        "class_name": source_class.get("name", ""),
        "owner": source_class.get("owner", current_owner()),
        "teacher_id": teacher_id,
        "stage": normalize_stage(payload.get("stage")),
        "locked_student_count": source_class_student_count(source_class),
        "student_count_note": "",
        "student_snapshot": source_class_student_snapshots(source_class),
        "student_followups": {},
        "note": "",
        "closing_month": "",
        "created_by": current_owner(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    store.setdefault("projects", []).append(project)
    save_store(store)
    return jsonify(build_payload()), 201


@renewal_bp.post("/legacy-followups")
@login_required
def create_legacy_followup_list():
    if not can_manage_accounts():
        return jsonify({"error": "只有管理员可以添加老班续费跟进班级。"}), 403
    payload = request.get_json(silent=True) or {}
    project_id = str(payload.get("project_id") or "").strip()
    if not project_id:
        return jsonify({"error": "请先选择续费项目里的班级。"}), 400

    store = load_store()
    project = find_project(store, project_id)
    if project is None:
        return jsonify({"error": "未找到对应的续费班级。"}), 404
    if any(str(item.get("project_id") or "") == project_id for item in store.get("legacy_followups", []) if isinstance(item, dict)):
        return jsonify({"error": "这个班级已经在老班续费跟进名单里。"}), 400

    classes_by_id = class_lookup()
    source_class = classes_by_id.get(project.get("class_id"))
    ensure_project_student_snapshot(project, source_class)
    student_rows = project_student_rows(project, source_class)
    teacher_id = class_teacher_id(source_class) if source_class else normalize_teacher_id(project.get("teacher_id"))
    legacy_list = {
        "id": uuid.uuid4().hex,
        "project_id": project_id,
        "class_id": str(project.get("class_id") or ""),
        "class_name": str((source_class or {}).get("name") or project.get("class_name") or "").strip(),
        "owner": str((source_class or {}).get("owner") or project.get("owner") or "").strip(),
        "teacher_id": teacher_id,
        "students": [
            legacy_followup_student_snapshot(student)
            for student in student_rows
            if legacy_completion_above_threshold(student)
        ],
        "created_by": current_owner(),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    store.setdefault("legacy_followups", []).append(legacy_list)
    project["updated_at"] = now_iso()
    save_store(store)
    return jsonify(build_payload()), 201


@renewal_bp.post("/legacy-followups/<legacy_list_id>/students")
@login_required
def add_legacy_followup_student(legacy_list_id):
    payload = request.get_json(silent=True) or {}
    student_id = str(payload.get("student_id") or "").strip()
    if not student_id:
        return jsonify({"error": "请先选择要加入名单的学员。"}), 400

    store = load_store()
    legacy_list = find_legacy_followup_list(store, legacy_list_id)
    if legacy_list is None or not can_edit_legacy_followup(legacy_list):
        return jsonify({"error": "老班续费跟进名单不存在。"}), 404
    project = find_project(store, legacy_list.get("project_id"))
    if project is None:
        return jsonify({"error": "原续费班级已移出项目，无法再添加学员。"}), 400
    source_class = class_lookup().get(project.get("class_id"))
    ensure_project_student_snapshot(project, source_class)
    student = next(
        (item for item in project_student_rows(project, source_class) if str(item.get("id") or "") == student_id),
        None,
    )
    if student is None:
        return jsonify({"error": "未找到该续费班级中的学员。"}), 404

    students = legacy_followup_students(legacy_list)
    if any(item["id"] == student_id for item in students):
        return jsonify({"error": "该学员已经在跟进名单中。"}), 400
    students.append(legacy_followup_student_snapshot(student))
    legacy_list["students"] = students
    legacy_list["updated_at"] = now_iso()
    project["updated_at"] = now_iso()
    save_store(store)
    return jsonify(build_payload()), 201


@renewal_bp.patch("/legacy-followups/<legacy_list_id>/students/<student_id>")
@login_required
def update_legacy_followup_student(legacy_list_id, student_id):
    payload = request.get_json(silent=True) or {}
    allowed_fields = {"current_blocker", "judgement"}
    if not any(field in payload for field in allowed_fields):
        return jsonify({"error": "没有可保存的跟进信息。"}), 400

    store = load_store()
    legacy_list = find_legacy_followup_list(store, legacy_list_id)
    if legacy_list is None or not can_edit_legacy_followup(legacy_list):
        return jsonify({"error": "老班续费跟进名单不存在。"}), 404
    target_id = str(student_id or "").strip()
    students = legacy_followup_students(legacy_list)
    student = next((item for item in students if item["id"] == target_id), None)
    if student is None:
        return jsonify({"error": "该学员不在跟进名单中。"}), 404

    if "current_blocker" in payload:
        student["current_blocker"] = str(payload.get("current_blocker") or "").strip()[:100]
    if "judgement" in payload:
        student["judgement"] = str(payload.get("judgement") or "").strip()[:500]
    legacy_list["students"] = students
    legacy_list["updated_at"] = now_iso()
    save_store(store)
    return jsonify(build_payload())


@renewal_bp.delete("/legacy-followups/<legacy_list_id>/students/<student_id>")
@login_required
def delete_legacy_followup_student(legacy_list_id, student_id):
    store = load_store()
    legacy_list = find_legacy_followup_list(store, legacy_list_id)
    if legacy_list is None or not can_edit_legacy_followup(legacy_list):
        return jsonify({"error": "老班续费跟进名单不存在。"}), 404
    target_id = str(student_id or "").strip()
    students = legacy_followup_students(legacy_list)
    next_students = [item for item in students if item["id"] != target_id]
    if len(next_students) == len(students):
        return jsonify({"error": "该学员不在跟进名单中。"}), 404
    legacy_list["students"] = next_students
    legacy_list["updated_at"] = now_iso()
    save_store(store)
    return jsonify(build_payload())


@renewal_bp.delete("/legacy-followups/<legacy_list_id>")
@login_required
def delete_legacy_followup_list(legacy_list_id):
    if not can_manage_accounts():
        return jsonify({"error": "只有管理员可以移出老班续费跟进班级。"}), 403
    store = load_store()
    legacy_list = find_legacy_followup_list(store, legacy_list_id)
    if legacy_list is None:
        return jsonify({"error": "老班续费跟进名单不存在。"}), 404
    store["legacy_followups"] = [
        item for item in store.get("legacy_followups", [])
        if item is not legacy_list
    ]
    save_store(store)
    return jsonify(build_payload())


@renewal_bp.patch("/projects/<project_id>")
@login_required
def update_project(project_id):
    payload = request.get_json(silent=True) or {}
    store = load_store()
    project = next((item for item in store.get("projects", []) if item.get("id") == project_id), None)
    if project is None or not can_edit_project(project):
        return jsonify({"error": "续费项目不存在。"}), 404

    if "stage" in payload:
        project["stage"] = normalize_stage(payload.get("stage"))
    if "note" in payload:
        project["note"] = str(payload.get("note") or "").strip()[:500]
    if "student_count" in payload or "locked_student_count" in payload:
        next_count = payload.get("student_count", payload.get("locked_student_count"))
        project["locked_student_count"] = normalize_locked_student_count(next_count)
    if "student_count_note" in payload:
        project["student_count_note"] = str(payload.get("student_count_note") or "").strip()[:300]
    if "manual_enrolled_count" in payload or "enrolled_count" in payload:
        next_count = payload.get("manual_enrolled_count", payload.get("enrolled_count"))
        manual_count = normalize_manual_enrolled_count(next_count)
        if manual_count is None:
            project.pop("manual_enrolled_count", None)
        else:
            project["manual_enrolled_count"] = manual_count
    if any(key in payload for key in ("target_count", "manual_month_enrolled_count", "historical_enrolled_count")):
        if not can_manage_accounts():
            return jsonify({"error": "只有管理员可以调整续费目标和报名拆分。"}), 403
        if normalize_stage(project.get("stage")) != RENEWAL_STAGES[0]:
            if "target_count" in payload:
                set_project_month_target(project, payload.get("target_count"))
            if "manual_month_enrolled_count" in payload or "historical_enrolled_count" in payload:
                source_class = class_lookup().get(project.get("class_id"))
                _, _, _, enrolled_count = project_enrollment_counts(project, source_class)
                if "manual_month_enrolled_count" in payload:
                    month_count = normalize_target_count(payload.get("manual_month_enrolled_count"))
                    set_project_manual_month_enrolled_count(
                        project,
                        min(month_count, enrolled_count) if month_count is not None else None,
                    )
                elif "historical_enrolled_count" in payload:
                    historical_count = normalize_target_count(payload.get("historical_enrolled_count"))
                    if historical_count is None:
                        set_project_manual_month_enrolled_count(project, None)
                    else:
                        # Keep the cumulative total unchanged while moving registrations into history.
                        set_project_manual_month_enrolled_count(
                            project,
                            max(0, enrolled_count - min(historical_count, enrolled_count)),
                        )
    if "closing_month" in payload:
        if not can_manage_accounts():
            return jsonify({"error": "只有管理员可以设置结营月份。"}), 403
        raw_closing_month = str(payload.get("closing_month") or "").strip()
        closing_month = normalize_closing_month(raw_closing_month)
        if raw_closing_month and not closing_month:
            return jsonify({"error": "结营月份格式不正确，请选择月份。"}), 400
        project["closing_month"] = closing_month
    project["updated_at"] = now_iso()
    save_store(store)
    return jsonify(build_payload())


@renewal_bp.get("/projects/<project_id>")
@login_required
def get_project(project_id):
    store = load_store()
    project = find_project(store, project_id)
    if project is None or not can_read_project(project):
        return jsonify({"error": "续费项目不存在。"}), 404
    class_store = load_class_store()
    classes_by_id = {item.get("id"): item for item in class_store.get("classes", []) if item.get("id")}
    source_class = classes_by_id.get(project.get("class_id"))
    changed = prune_project_followups(project, source_class)
    changed = ensure_project_student_count_lock(project, source_class) or changed
    changed = ensure_project_student_snapshot(project, source_class) or changed
    if changed:
        save_store(store)
    return jsonify({"project": serialize_project_detail(project, classes_by_id)})


@renewal_bp.patch("/projects/<project_id>/students/<student_id>")
@login_required
def update_student_enrollment(project_id, student_id):
    payload = request.get_json(silent=True) or {}
    store = load_store()
    project = find_project(store, project_id)
    if project is None or not can_edit_project(project):
        return jsonify({"error": "续费项目不存在。"}), 404

    class_store = load_class_store()
    classes_by_id = {item.get("id"): item for item in class_store.get("classes", []) if item.get("id")}
    source_class = classes_by_id.get(project.get("class_id"))
    student = None
    if source_class:
        student = next(
            (item for item in source_class.get("students", []) if str(item.get("id")) == str(student_id)),
            None,
        )
    snapshot_student = find_project_snapshot_student(project, student_id)
    if student is None and snapshot_student is None:
        return jsonify({"error": "学员不存在。"}), 404

    record = student_followup_record(project, student_id)
    had_update = False
    class_had_update = False
    if "student_name" in payload:
        next_name = str(payload.get("student_name") or "").strip()[:80]
        if not next_name:
            return jsonify({"error": "请输入学员姓名。"}), 400
        current_name = str((student or snapshot_student or {}).get("name") or "").strip()
        if next_name != current_name:
            updated_at = now_iso()
            if student is not None:
                student["name"] = next_name
                student["name_locked"] = True
                student["updated_at"] = updated_at
                source_class["updated_at"] = updated_at
                class_had_update = True
            else:
                had_update = update_project_snapshot_student(project, student_id, {"name": next_name}) or had_update
    if "followup_status" in payload:
        record["status"] = normalize_followup_status(payload.get("followup_status"))
        had_update = True
    elif "followup_priority" in payload:
        record["priority"] = normalize_followup_priority(payload.get("followup_priority"))
        had_update = True
    elif "enrolled" in payload:
        next_enrolled = bool(payload.get("enrolled"))
        was_enrolled = bool(record.get("enrolled"))
        record["enrolled"] = next_enrolled
        if next_enrolled and not was_enrolled:
            record["enrolled_at"] = now_iso()
        if not next_enrolled:
            record.pop("enrolled_at", None)
        manual_month_enrolled_count = project_manual_month_enrolled_count(project)
        if manual_month_enrolled_count is not None and next_enrolled != was_enrolled:
            # After a manual split, later checkbox changes default to this month's new signups.
            set_project_manual_month_enrolled_count(
                project,
                max(0, manual_month_enrolled_count + (1 if next_enrolled else -1)),
            )
        had_update = True
    elif "current_blocker" in payload:
        record["current_blocker"] = normalize_blocker(payload.get("current_blocker"))
        had_update = True
    elif "weekly_followup" in payload and isinstance(payload.get("weekly_followup"), dict):
        had_update = append_weekly_followup(record, payload.get("weekly_followup"))
    elif "general_followup" in payload and isinstance(payload.get("general_followup"), dict):
        had_update = append_general_followup(record, payload.get("general_followup"))
    if "followup_note" in payload:
        had_update = append_followup_note(record, payload.get("followup_note"), prefix_date=True) or had_update
    if "followup_note_replace" in payload:
        had_update = replace_followup_note(record, payload.get("followup_note_replace")) or had_update
    if "followup_note_update" in payload:
        had_update = update_followup_note(record, payload.get("followup_note_update")) or had_update
    if "followup_note_delete" in payload:
        had_update = delete_followup_note(record, payload.get("followup_note_delete")) or had_update
    if "leader_note" in payload:
        if not can_manage_accounts():
            return jsonify({"error": "只有管理员可以填写盘单。"}), 403
        next_note = str(payload.get("leader_note") or "").strip()[:500]
        if next_note != record.get("leader_note"):
            record["leader_note"] = next_note
            record["leader_note_updated_at"] = now_iso() if next_note else ""
            record["leader_note_done"] = False
            record["leader_note_done_at"] = ""
            had_update = True
    if "leader_action_type" in payload:
        if not can_manage_accounts():
            return jsonify({"error": "只有管理员可以设置盘单类型。"}), 403
        next_action_type = normalize_leader_action_type(payload.get("leader_action_type"))
        if next_action_type != record.get("leader_action_type"):
            record["leader_action_type"] = next_action_type
            has_plan_content = bool(record.get("leader_note") or record.get("leader_talk_text") or next_action_type == "去电")
            record["leader_note_updated_at"] = now_iso() if has_plan_content else ""
            record["leader_note_done"] = False
            record["leader_note_done_at"] = ""
            had_update = True
    if any(key in payload for key in ("leader_talk_keyword", "leader_talk_type", "leader_talk_title", "leader_talk_text")):
        if not can_manage_accounts():
            return jsonify({"error": "只有管理员可以选择盘单话术。"}), 403
        next_keyword = str(payload.get("leader_talk_keyword", record.get("leader_talk_keyword")) or "").strip()[:120]
        next_type = str(payload.get("leader_talk_type", record.get("leader_talk_type")) or "").strip()[:40]
        next_title = str(payload.get("leader_talk_title", record.get("leader_talk_title")) or "").strip()[:180]
        next_text = str(payload.get("leader_talk_text", record.get("leader_talk_text")) or "").strip()[:5000]
        if (
            next_keyword != record.get("leader_talk_keyword")
            or next_type != record.get("leader_talk_type")
            or next_title != record.get("leader_talk_title")
            or next_text != record.get("leader_talk_text")
        ):
            record["leader_talk_keyword"] = next_keyword
            record["leader_talk_type"] = next_type
            record["leader_talk_title"] = next_title
            record["leader_talk_text"] = next_text
            record["leader_note_updated_at"] = now_iso() if (record.get("leader_note") or next_text) else ""
            record["leader_note_done"] = False
            record["leader_note_done_at"] = ""
            had_update = True
    if "leader_note_done" in payload:
        record["leader_note_done"] = bool(payload.get("leader_note_done"))
        record["leader_note_done_at"] = now_iso() if record["leader_note_done"] else ""
        had_update = True
    if (
        had_update
        and "weekly_followup" not in payload
        and "general_followup" not in payload
        and "followup_priority" not in payload
    ):
        record["followed_at"] = now_iso()
    had_update = ensure_project_student_snapshot(project, source_class) or had_update
    if had_update:
        project["updated_at"] = now_iso()
        save_store(store)
    if class_had_update:
        save_class_store(class_store)
    return jsonify({
        "project": serialize_project_detail(project, classes_by_id),
        "board": build_payload(),
    })


@renewal_bp.post("/history-upload")
@login_required
def upload_renewal_history():
    if not can_manage_accounts():
        return jsonify({"error": "只有管理员可以上传续费历史数据。"}), 403

    file_storage = request.files.get("file")
    if not file_storage or not file_storage.filename:
        return jsonify({"error": "请先选择要上传的续费历史数据表。"}), 400

    try:
        records = parse_renewal_upload_file(file_storage)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        current_app.logger.exception("renewal history upload failed")
        return jsonify({"error": "续费历史数据解析失败，请确认表格格式。"}), 400

    if not records:
        return jsonify({"error": "没有识别到可导入的数据，请确认表头包含班级名称和学员姓名/账号。"}), 400

    store = load_store()
    classes_by_id = class_lookup()
    imported_count = 0
    created_project_count = 0
    touched_project_ids = set()
    skipped_rows = []

    for record in records:
        teacher_id = teacher_id_from_upload(record.get("teacher"))
        source_class, class_error = find_upload_class(classes_by_id, record.get("class_name"), teacher_id)
        if source_class is None:
            skipped_rows.append({
                "row": skipped_upload_label(record),
                "reason": class_error,
                "class_name": record.get("class_name", ""),
                "student": record.get("student_name") or record.get("student_account") or "",
            })
            continue

        student, student_error = find_student_for_upload(
            source_class,
            record.get("student_account"),
            record.get("student_name"),
        )
        if student is None:
            skipped_rows.append({
                "row": skipped_upload_label(record),
                "reason": student_error,
                "class_name": source_class.get("name", ""),
                "student": record.get("student_name") or record.get("student_account") or "",
            })
            continue

        stage = normalize_upload_stage(record.get("stage"))
        project, created = ensure_upload_project(store, source_class, stage)
        if created:
            created_project_count += 1

        student_id = str(student.get("id") or "")
        followup = student_followup_record(project, student_id)
        had_update = False
        project_stage = normalize_stage(project.get("stage"))

        status = normalize_upload_status(record.get("followup_status"))
        if status:
            followup["status"] = normalize_followup_status(status)
            had_update = True

        enrolled = parse_upload_bool(record.get("enrolled"))
        if enrolled is not None:
            followup["enrolled"] = enrolled
            had_update = True

        blocker = normalize_upload_blocker(record.get("blocker"), store)
        if blocker:
            followup["current_blocker"] = blocker
            had_update = True

        methods = normalize_upload_methods(record.get("methods"))
        if methods:
            week = parse_upload_week(record.get("week"))
            followup_payload = {
                "date": record.get("date"),
                "methods": methods,
            }
            if project_stage in RENEWAL_FOUR_WEEK_STAGES and week:
                followup_payload["week"] = week
                had_update = append_weekly_followup(followup, followup_payload) or had_update
            else:
                had_update = append_general_followup(followup, followup_payload) or had_update
        elif record.get("date"):
            followup["followed_at"] = f"{normalize_followup_date(record.get('date'))}T00:00:00"
            had_update = True

        note = clean_upload_note(record.get("note"))
        if note:
            had_update = append_followup_note(followup, note) or had_update

        if had_update:
            imported_count += 1
            project["updated_at"] = now_iso()
            touched_project_ids.add(project.get("id", ""))

    if imported_count or created_project_count:
        save_store(store)

    return jsonify({
        "ok": True,
        "imported_count": imported_count,
        "created_project_count": created_project_count,
        "updated_project_count": len([item for item in touched_project_ids if item]),
        "skipped_count": len(skipped_rows),
        "skipped_rows": skipped_rows[:12],
        "board": build_payload(),
    })


@renewal_bp.delete("/projects/<project_id>")
@login_required
def delete_project(project_id):
    store = load_store()
    before = len(store.get("projects", []))
    store["projects"] = [
        project
        for project in store.get("projects", [])
        if not (project.get("id") == project_id and can_edit_project(project))
    ]
    if len(store["projects"]) == before:
        return jsonify({"error": "续费项目不存在。"}), 404
    save_store(store)
    return jsonify(build_payload())
