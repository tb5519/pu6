import re


TEACHERS = [
    {"id": "wenyun_joanna", "username": "文云joanna", "name": "文云Joanna", "aliases": ["文云", "joanna"]},
    {"id": "chenxiao_grace", "username": "陈晓grace", "name": "陈晓Grace", "aliases": ["陈晓", "grace"]},
    {"id": "xiaojun_linm", "username": "肖钧linm", "name": "肖钧Linm", "aliases": ["肖钧", "linm"]},
    {"id": "huxiaoran_serena", "username": "胡小冉serena", "name": "胡小冉Serena", "aliases": ["胡小冉", "serena"]},
    {"id": "huchangjing_jean", "username": "胡常菁jean", "name": "胡常菁Jean", "aliases": ["胡常菁", "jean"]},
    {"id": "dongjie_jackie", "username": "董洁jackie", "name": "董洁Jackie", "aliases": ["董洁", "jackie"]},
]


TEACHER_BY_ID = {teacher["id"]: teacher for teacher in TEACHERS}
TEACHER_BY_USERNAME = {teacher["username"]: teacher for teacher in TEACHERS}


def normalize_teacher_id(value):
    teacher_id = str(value or "").strip()
    return teacher_id if teacher_id in TEACHER_BY_ID else ""


def teacher_label(teacher_id):
    teacher = TEACHER_BY_ID.get(normalize_teacher_id(teacher_id))
    return teacher["name"] if teacher else ""


def teacher_options():
    return [{"id": teacher["id"], "name": teacher["name"]} for teacher in TEACHERS]


def teacher_id_for_username(username):
    teacher = TEACHER_BY_USERNAME.get(str(username or "").strip().lower())
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
