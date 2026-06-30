import json
import re
from pathlib import Path

from flask import current_app, has_app_context


BASE_TEACHERS = [
    {"id": "wenyun_joanna", "username": "文云joanna", "name": "文云Joanna", "aliases": ["文云", "joanna"]},
    {"id": "chenxiao_grace", "username": "陈晓grace", "name": "陈晓Grace", "aliases": ["陈晓", "grace"]},
    {"id": "xiaojun_linm", "username": "肖钧linm", "name": "肖钧Linm", "aliases": ["肖钧", "linm"]},
    {"id": "huxiaoran_serena", "username": "胡小冉serena", "name": "胡小冉Serena", "aliases": ["胡小冉", "serena"]},
    {"id": "huchangjing_jean", "username": "胡常菁jean", "name": "胡常菁Jean", "aliases": ["胡常菁", "jean"]},
    {"id": "dongjie_jackie", "username": "董洁jackie", "name": "董洁Jackie", "aliases": ["董洁", "jackie"]},
]


def normalize_account_teacher_id(value):
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^\w\u4e00-\u9fff]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text[:48] or "teacher"


def dynamic_teachers_from_users():
    if not has_app_context():
        return []
    path = Path(current_app.config.get("USERS_FILE", ""))
    if not path.exists():
        return []
    try:
        with path.open("r", encoding="utf-8") as file:
            users = json.load(file)
    except (OSError, json.JSONDecodeError):
        return []

    base_ids = {teacher["id"] for teacher in BASE_TEACHERS}
    dynamic = []
    seen = set(base_ids)
    for user in users.values():
        if not isinstance(user, dict) or not user.get("active", True):
            continue
        teacher_id = str(user.get("teacher_id") or "").strip()
        if not teacher_id or teacher_id in seen:
            continue
        username = str(user.get("username") or "").strip().lower()
        display_name = str(user.get("display_name") or "").strip()
        dynamic.append(
            {
                "id": teacher_id,
                "username": username,
                "name": display_name or username or teacher_id,
                "aliases": [value for value in (display_name, username) if value],
            }
        )
        seen.add(teacher_id)
    return dynamic


def all_teachers():
    return [*BASE_TEACHERS, *dynamic_teachers_from_users()]


class TeacherCollection:
    def __iter__(self):
        return iter(all_teachers())

    def __len__(self):
        return len(all_teachers())

    def __getitem__(self, index):
        return all_teachers()[index]


TEACHERS = TeacherCollection()


def teachers_by_id():
    return {teacher["id"]: teacher for teacher in all_teachers()}


def teachers_by_username():
    return {
        str(teacher.get("username") or "").strip().lower(): teacher
        for teacher in all_teachers()
        if str(teacher.get("username") or "").strip()
    }


def normalize_teacher_id(value):
    teacher_id = str(value or "").strip()
    return teacher_id if teacher_id in teachers_by_id() else ""


def teacher_label(teacher_id):
    teacher = teachers_by_id().get(normalize_teacher_id(teacher_id))
    return teacher["name"] if teacher else ""


def teacher_options():
    return [{"id": teacher["id"], "name": teacher["name"]} for teacher in all_teachers()]


def teacher_id_for_username(username):
    teacher = teachers_by_username().get(str(username or "").strip().lower())
    return teacher["id"] if teacher else ""


def normalize_match_text(value):
    return re.sub(r"\s+", "", str(value or "").lower())


def infer_teacher_id_from_class_name(class_name):
    normalized_name = normalize_match_text(class_name)
    if not normalized_name:
        return ""

    for teacher in TEACHERS:
        candidates = [teacher["name"], *teacher["aliases"]]
        if any(normalize_match_text(candidate) in normalized_name for candidate in candidates):
            return teacher["id"]
    return ""
