import csv
import io
import json
import re
import uuid
from datetime import datetime

from flask import Blueprint, current_app, g, jsonify, request
from openpyxl import load_workbook

from app.auth import login_required
from app.teachers import infer_teacher_id_from_class_name, normalize_teacher_id, teacher_label, teacher_options


classes_bp = Blueprint("classes", __name__, url_prefix="/api/classes")

WEEK_COUNT = 4
DAY_COUNT = 6
HEADER_SCAN_LIMIT = 20
CHINESE_NUMBERS = {
    1: "一",
    2: "二",
    3: "三",
    4: "四",
    5: "五",
    6: "六",
}

NAME_COLUMNS = {
    "姓名",
    "名字",
    "学员",
    "学生",
    "学员姓名",
    "学生姓名",
    "孩子姓名",
    "宝贝姓名",
    "用户姓名",
    "昵称",
    "name",
    "studentname",
}
ACCOUNT_COLUMNS = {
    "账号",
    "帐号",
    "学号",
    "学员账号",
    "学员帐号",
    "学生账号",
    "学生帐号",
    "用户账号",
    "用户帐号",
    "账号id",
    "学员id",
    "学生id",
    "account",
    "studentaccount",
    "studentid",
    "userid",
    "id",
}


def classes_file():
    return current_app.config["CLASSES_FILE"]


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def current_month_key():
    return datetime.now().strftime("%Y-%m")


def load_store():
    path = classes_file()
    if not path.exists():
        return {"classes": []}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_store(store):
    path = classes_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(store, file, ensure_ascii=False, indent=2)


def current_owner():
    return g.user["username"]


def blank_week():
    return [None for _ in range(DAY_COUNT)]


def normalize_week_values(values):
    output = blank_week()
    if not isinstance(values, list):
        return output
    for index in range(min(DAY_COUNT, len(values))):
        output[index] = parse_completion(values[index])
    return output


def normalize_weeks(weeks):
    output = {str(week): blank_week() for week in range(1, WEEK_COUNT + 1)}
    if not isinstance(weeks, dict):
        return output
    for week in range(1, WEEK_COUNT + 1):
        output[str(week)] = normalize_week_values(weeks.get(str(week)))
    return output


def get_student_account(student):
    return str(student.get("account") or student.get("phone") or "").strip()


def get_student_weeks(student, month_key):
    months = student.get("months")
    if isinstance(months, dict):
        month_data = months.get(month_key, {})
        return normalize_weeks(month_data.get("weeks", {}))
    return normalize_weeks(student.get("weeks", {}))


def ensure_month_data(student, month_key):
    months = student.setdefault("months", {})
    month_data = months.setdefault(month_key, {})
    month_data["weeks"] = normalize_weeks(month_data.get("weeks", {}))
    return month_data


def calculate_monthly_completion(weeks):
    values = []
    for week_values in weeks.values():
        values.extend(value for value in week_values if value is not None)
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def uploaded_day_values(weeks):
    values = []
    for week_key in sorted(weeks, key=lambda value: int(value)):
        week_values = weeks[week_key]
        for day_index, value in enumerate(week_values, start=1):
            if value is not None:
                values.append({"week": int(week_key), "day": day_index, "value": value})
    return values


def has_abnormal_break(values):
    previous_value = None
    has_previous_full_completion = False
    low_streak_after_completion = 0

    for item in values:
        value = item["value"]

        if previous_value is not None and previous_value >= 100 and value < 100:
            return True

        if value >= 100:
            has_previous_full_completion = True
            low_streak_after_completion = 0
        elif has_previous_full_completion:
            low_streak_after_completion += 1
            if low_streak_after_completion >= 3:
                return True
        else:
            low_streak_after_completion = 0

        previous_value = value
    return False


def classify_student_habit(weeks):
    values = uploaded_day_values(weeks)
    if not values:
        return "暂无数据"

    if all(item["value"] == 0 for item in values):
        return "长期不上课"

    if all(item["value"] >= 100 for item in values):
        return "完课超赞"

    incomplete_values = [item for item in values if item["value"] < 100]
    if incomplete_values and all(item["day"] == DAY_COUNT for item in incomplete_values):
        return "周末欠缺"

    if has_abnormal_break(values):
        return "异常断课"

    return "偶尔断课"


def serialize_student(student):
    month_key = current_month_key()
    weeks = get_student_weeks(student, month_key)
    return {
        "id": student.get("id", ""),
        "name": str(student.get("name") or "").strip(),
        "account": get_student_account(student),
        "month": month_key,
        "monthly_completion": calculate_monthly_completion(weeks),
        "habit_category": classify_student_habit(weeks),
        "weeks": weeks,
        "updated_at": student.get("updated_at", ""),
    }


def serialize_class(item, include_students=False):
    students = item.get("students", [])
    teacher_id = normalize_teacher_id(item.get("teacher_id")) or infer_teacher_id_from_class_name(item.get("name"))
    output = {
        "id": item["id"],
        "name": item["name"],
        "note": str(item.get("note") or "").strip(),
        "teacher_id": teacher_id,
        "teacher_name": teacher_label(teacher_id),
        "student_count": len(students),
        "completion_activity": bool(item.get("completion_activity")),
        "created_at": item.get("created_at", ""),
        "updated_at": item.get("updated_at", ""),
    }
    if include_students:
        output["students"] = [serialize_student(student) for student in students]
        output["month"] = current_month_key()
    return output


def find_owned_class(store, class_id):
    for item in store["classes"]:
        if item["id"] == class_id and item["owner"] == current_owner():
            return item
    return None


def find_student(target_class, student_id):
    for student in target_class.get("students", []):
        if student.get("id") == student_id:
            return student
    return None


def normalize_header(value):
    text = str(value or "").replace("\u3000", " ").strip().lower()
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"[：:（）()\[\]【】{}<>《》\"“”'‘’、,，.。/\\|_\-]+", "", text)
    text = text.replace("必填", "").replace("选填", "")
    return text


def pick_column(headers, candidates):
    normalized = [normalize_header(header) for header in headers]
    candidate_values = [normalize_header(candidate) for candidate in candidates]

    lookup = {header: index for index, header in enumerate(normalized) if header}
    for candidate in candidate_values:
        index = lookup.get(candidate)
        if index is not None:
            return index

    for index, header in enumerate(normalized):
        if not header:
            continue
        for candidate in candidate_values:
            if candidate and (candidate in header or header in candidate):
                return index
    return None


def has_day_label(header, day):
    normalized_header = normalize_header(header)
    return any(normalize_header(candidate) in normalized_header for candidate in day_aliases(day))


def is_daily_completion_header(header):
    normalized_header = normalize_header(header)
    return any(
        keyword in normalized_header
        for keyword in (
            "当日完成度",
            "当日完成率",
            "当日完课度",
            "当日完课率",
            "当天完成度",
            "当天完成率",
            "当天完课度",
            "当天完课率",
            "本日完成度",
            "本日完成率",
            "本日完课度",
            "本日完课率",
        )
    )


def day_aliases(day):
    chinese = CHINESE_NUMBERS[day]
    return {
        f"day{day}",
        f"d{day}",
        f"{day}天",
        f"{day}日",
        f"第{day}天",
        f"第{day}日",
        f"{day}天当日完成度",
        f"{day}日当日完成度",
        f"第{day}天当日完成度",
        f"第{day}日当日完成度",
        f"第{day}天完成度",
        f"第{day}日完成度",
        f"{chinese}天",
        f"{chinese}日",
        f"第{chinese}天",
        f"第{chinese}日",
        f"{chinese}天当日完成度",
        f"{chinese}日当日完成度",
        f"第{chinese}天当日完成度",
        f"第{chinese}日当日完成度",
        f"第{chinese}天完成度",
        f"第{chinese}日完成度",
    }


def row_texts(row, width):
    return [str(row[index] or "").strip() if index < len(row) else "" for index in range(width)]


def fill_merged_parent_cells(values):
    filled = []
    current = ""
    for value in values:
        if value:
            current = value
        filled.append(current)
    return filled


def build_headers(rows, row_index):
    start_index = max(0, row_index - 2)
    context_rows = rows[start_index:row_index + 1]
    width = max((len(row) for row in context_rows), default=0)
    prepared_rows = []

    for offset, row in enumerate(context_rows):
        values = row_texts(row, width)
        if start_index + offset < row_index:
            values = fill_merged_parent_cells(values)
        prepared_rows.append(values)

    headers = []
    for column_index in range(width):
        parts = []
        for values in prepared_rows:
            value = values[column_index]
            if value and (not parts or parts[-1] != value):
                parts.append(value)
        headers.append(" ".join(parts))
    return headers


def pick_day_columns(headers):
    normalized = [normalize_header(header) for header in headers]
    day_columns = {}
    used_indexes = set()
    has_daily_completion_row = any(is_daily_completion_header(header) for header in headers)

    for day in range(1, DAY_COUNT + 1):
        candidates = [normalize_header(candidate) for candidate in day_aliases(day)]
        for index, header in enumerate(headers):
            if index in used_indexes:
                continue
            if has_day_label(header, day) and is_daily_completion_header(header):
                day_columns[day] = index
                used_indexes.add(index)
                break
        if day in day_columns:
            continue
        if has_daily_completion_row:
            continue
        for index, header in enumerate(normalized):
            if index in used_indexes or not header:
                continue
            if header in candidates:
                day_columns[day] = index
                used_indexes.add(index)
                break
        if day in day_columns:
            continue
        for index, header in enumerate(normalized):
            if index in used_indexes or not header:
                continue
            if any(candidate and candidate in header for candidate in candidates):
                day_columns[day] = index
                used_indexes.add(index)
                break
    return day_columns


def non_empty_cells(row):
    return [str(value).strip() for value in row if str(value or "").strip()]


def readable_headers(rows):
    candidates = []
    for row in rows[:HEADER_SCAN_LIMIT]:
        cells = non_empty_cells(row)
        if cells:
            candidates.append("、".join(cells[:10]))
    return "；".join(candidates[:5])


def find_header_row(rows):
    best = None
    for row_index, row in enumerate(rows[:HEADER_SCAN_LIMIT]):
        headers = build_headers(rows, row_index)
        if not any(headers):
            continue
        day_columns = pick_day_columns(headers)
        has_daily_completion_row = any(is_daily_completion_header(header) for header in headers)
        indexes = {
            "name": pick_column(headers, NAME_COLUMNS),
            "account": pick_column(headers, ACCOUNT_COLUMNS),
            "days": day_columns,
        }
        score = 0
        score += 5 if indexes["name"] is not None else 0
        score += 5 if indexes["account"] is not None else 0
        score += len(day_columns) * 2
        score += 20 if has_daily_completion_row and day_columns else 0
        if best is None or score > best["score"]:
            best = {"score": score, "row_index": row_index, "headers": headers, "indexes": indexes}
    return best


def missing_column_error(column_name, examples, rows):
    preview = readable_headers(rows)
    message = f"表格需要包含“{column_name}”列，常见列名：{examples}。"
    if preview:
        message += f" 已读取到的前几行内容：{preview}"
    return message


def parse_completion(value):
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        rate = float(value)
        if 0 <= rate <= 1:
            rate *= 100
        return max(0, min(100, round(rate, 2)))

    text = str(value).strip().replace("％", "%")
    if not text:
        return None

    normalized_text = normalize_header(text)
    if normalized_text in {"完成", "已完成", "是", "yes", "y", "true", "√", "对"}:
        return 100
    if normalized_text in {"未完成", "没完成", "否", "no", "n", "false", "x", "×", "错", "缺课"}:
        return 0

    if text.endswith("%"):
        text = text[:-1]
    try:
        rate = float(text)
    except ValueError:
        return None
    if 0 <= rate <= 1:
        rate *= 100
    return max(0, min(100, round(rate, 2)))


def row_value(row, index):
    if index is None or index >= len(row):
        return ""
    value = row[index]
    return "" if value is None else str(value).strip()


def rows_to_students(rows):
    if not rows:
        return []

    header = find_header_row(rows)
    indexes = header["indexes"] if header else {}
    header_row_index = header["row_index"] if header else 0
    name_index = indexes.get("name")
    account_index = indexes.get("account")
    day_columns = indexes.get("days", {})

    if name_index is None:
        raise ValueError(missing_column_error("学员姓名", "学员姓名、学生姓名、孩子姓名、姓名", rows))
    if account_index is None:
        raise ValueError(missing_column_error("学员账号", "学员账号、学生账号、账号、学号、ID", rows))
    if not day_columns:
        raise ValueError(missing_column_error("Day1-Day6", "第一天当日完成度、第二天当日完成度、Day1、Day2", rows))

    students = []
    for row in rows[header_row_index + 1:]:
        name = row_value(row, name_index)
        account = row_value(row, account_index)
        if not name:
            continue
        days = {}
        for day, column_index in day_columns.items():
            value = row[column_index] if column_index < len(row) else None
            days[str(day)] = parse_completion(value)
        students.append(
            {
                "name": name,
                "account": account,
                "days": days,
                "updated_at": now_iso(),
            }
        )

    if not students:
        raise ValueError("没有读取到学员数据，请确认表头下面存在学员记录。")
    return students


def parse_csv(file_storage):
    raw = file_storage.stream.read()
    for encoding in ("utf-8-sig", "gb18030", "gbk"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError("CSV 编码无法识别，请另存为 UTF-8 或 Excel .xlsx 后再上传。")
    return list(csv.reader(io.StringIO(text)))


def parse_xlsx_sheets(file_storage):
    workbook = load_workbook(file_storage, data_only=True)
    for sheet in workbook.worksheets:
        rows = [[cell for cell in row] for row in sheet.iter_rows(values_only=True)]
        yield sheet.title, rows


def parse_upload(file_storage):
    filename = (file_storage.filename or "").lower()
    if filename.endswith(".csv"):
        rows = parse_csv(file_storage)
        return rows_to_students(rows)
    if filename.endswith(".xlsx"):
        errors = []
        for sheet_name, rows in parse_xlsx_sheets(file_storage):
            try:
                return rows_to_students(rows)
            except ValueError as error:
                errors.append(f"{sheet_name}：{error}")
        detail = errors[0] if errors else "没有读取到工作表内容。"
        raise ValueError(f"未在 Excel 工作表中识别到可导入数据。{detail}")
    raise ValueError("仅支持 .xlsx 或 .csv 文件。")


def parse_week_number(value):
    try:
        week = int(value)
    except (TypeError, ValueError):
        raise ValueError("请选择本月第几周。") from None
    if week < 1 or week > WEEK_COUNT:
        raise ValueError("周数只能选择第一周到第四周。")
    return str(week)


def normalize_identity(value):
    return str(value or "").strip().lower()


def sync_students_from_upload(target_class, imported_students, week_number):
    students = target_class.setdefault("students", [])
    existing_by_account = {
        normalize_identity(get_student_account(student)): student
        for student in students
        if normalize_identity(get_student_account(student))
    }
    existing_by_name = {
        normalize_identity(student.get("name")): student
        for student in students
        if normalize_identity(student.get("name"))
    }

    month_key = current_month_key()
    updated_at = now_iso()
    updated = 0
    created = 0
    matched_student_ids = set()
    synced_students = []

    for imported in imported_students:
        account_key = normalize_identity(imported.get("account"))
        name_key = normalize_identity(imported.get("name"))
        current = None
        if account_key:
            current = existing_by_account.get(account_key)
        if current is None and name_key:
            current = existing_by_name.get(name_key)
        if current is not None and current.get("id") in matched_student_ids:
            current = None

        if current:
            updated += 1
        else:
            current = {
                "id": uuid.uuid4().hex,
                "name": "",
                "account": "",
                "months": {},
                "created_at": updated_at,
            }
            created += 1

        current["name"] = imported.get("name", current.get("name", "")).strip()
        current["account"] = imported.get("account", current.get("account", "")).strip()
        current["updated_at"] = updated_at

        if imported.get("days"):
            month_data = ensure_month_data(current, month_key)
            week_values = blank_week()
            for day, value in imported["days"].items():
                day_index = int(day) - 1
                if 0 <= day_index < DAY_COUNT:
                    week_values[day_index] = value
            month_data["weeks"][week_number] = week_values

        if normalize_identity(current.get("account")):
            existing_by_account[normalize_identity(current.get("account"))] = current
        if normalize_identity(current.get("name")):
            existing_by_name[normalize_identity(current.get("name"))] = current
        matched_student_ids.add(current["id"])
        synced_students.append(current)

    removed = len([student for student in students if student.get("id") not in matched_student_ids])
    target_class["students"] = synced_students
    target_class["updated_at"] = updated_at
    return {"created": created, "updated": updated, "removed": removed, "week": week_number}


def clear_current_month_data(target_class):
    month_key = current_month_key()
    cleared = 0
    for student in target_class.get("students", []):
        had_data = False
        months = student.get("months")
        if isinstance(months, dict) and month_key in months:
            months.pop(month_key, None)
            had_data = True
        if "weeks" in student:
            student.pop("weeks", None)
            had_data = True
        if "completion_rate" in student:
            student.pop("completion_rate", None)
            had_data = True
        if had_data:
            student["updated_at"] = now_iso()
            cleared += 1
    target_class["updated_at"] = now_iso()
    return {"cleared": cleared, "month": month_key}


@classes_bp.get("")
@login_required
def list_classes():
    store = load_store()
    classes = [
        serialize_class(item)
        for item in store["classes"]
        if item["owner"] == current_owner()
    ]
    return jsonify({"classes": classes, "teachers": teacher_options()})


@classes_bp.post("")
@login_required
def create_class():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()
    if not name:
        return jsonify({"error": "请输入班级名称。"}), 400
    teacher_id = normalize_teacher_id(payload.get("teacher_id"))

    store = load_store()
    item = {
        "id": uuid.uuid4().hex,
        "owner": current_owner(),
        "name": name,
        "note": "",
        "teacher_id": teacher_id,
        "students": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    store["classes"].append(item)
    save_store(store)
    return jsonify({"class": serialize_class(item, include_students=True)}), 201


@classes_bp.patch("/<class_id>")
@login_required
def update_class(class_id):
    payload = request.get_json(silent=True) or {}
    store = load_store()
    item = find_owned_class(store, class_id)
    if item is None:
        return jsonify({"error": "班级不存在。"}), 404

    if "name" in payload:
        name = str(payload.get("name") or "").strip()
        if not name:
            return jsonify({"error": "请输入班级名称。"}), 400
        item["name"] = name
    if "note" in payload:
        item["note"] = str(payload.get("note") or "").strip()[:300]
    if "teacher_id" in payload:
        item["teacher_id"] = normalize_teacher_id(payload.get("teacher_id"))
    if "completion_activity" in payload:
        item["completion_activity"] = bool(payload.get("completion_activity"))

    item["updated_at"] = now_iso()
    save_store(store)
    return jsonify({"class": serialize_class(item, include_students=True)})


@classes_bp.get("/<class_id>")
@login_required
def get_class(class_id):
    store = load_store()
    item = find_owned_class(store, class_id)
    if item is None:
        return jsonify({"error": "班级不存在。"}), 404
    return jsonify({"class": serialize_class(item, include_students=True)})


@classes_bp.delete("/<class_id>")
@login_required
def delete_class(class_id):
    store = load_store()
    before = len(store["classes"])
    store["classes"] = [
        item
        for item in store["classes"]
        if not (item["id"] == class_id and item["owner"] == current_owner())
    ]
    if len(store["classes"]) == before:
        return jsonify({"error": "班级不存在。"}), 404
    save_store(store)
    return jsonify({"ok": True})


@classes_bp.delete("/<class_id>/month-data")
@login_required
def clear_month_data(class_id):
    store = load_store()
    item = find_owned_class(store, class_id)
    if item is None:
        return jsonify({"error": "班级不存在。"}), 404

    result = clear_current_month_data(item)
    save_store(store)
    return jsonify({"result": result, "class": serialize_class(item, include_students=True)})


@classes_bp.patch("/<class_id>/students/<student_id>")
@login_required
def update_student(class_id, student_id):
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name") or "").strip()
    if not name:
        return jsonify({"error": "请输入学员姓名。"}), 400

    store = load_store()
    item = find_owned_class(store, class_id)
    if item is None:
        return jsonify({"error": "班级不存在。"}), 404

    student = find_student(item, student_id)
    if student is None:
        return jsonify({"error": "学员不存在。"}), 404

    updated_at = now_iso()
    student["name"] = name
    student["updated_at"] = updated_at
    item["updated_at"] = updated_at
    save_store(store)
    return jsonify({
        "student": serialize_student(student),
        "class": serialize_class(item, include_students=True),
    })


@classes_bp.post("/<class_id>/upload")
@login_required
def upload_students(class_id):
    file_storage = request.files.get("file")
    if not file_storage:
        return jsonify({"error": "请上传 Excel 或 CSV 文件。"}), 400

    try:
        week_number = parse_week_number(request.form.get("week"))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    store = load_store()
    item = find_owned_class(store, class_id)
    if item is None:
        return jsonify({"error": "班级不存在。"}), 404

    try:
        imported_students = parse_upload(file_storage)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400

    result = sync_students_from_upload(item, imported_students, week_number)
    save_store(store)
    return jsonify({"result": result, "class": serialize_class(item, include_students=True)})
