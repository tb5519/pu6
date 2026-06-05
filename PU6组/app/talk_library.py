import json
from datetime import datetime, timezone

from flask import Blueprint, current_app, g, jsonify, request

from app.auth import can_manage_accounts, login_required


talk_library_bp = Blueprint("talk_library", __name__, url_prefix="/api/talk-library")

LEARNING_CALL_TITLES = ["首通电话", "第二通电话", "第三通电话", "第四通电话", "第五通电话"]
LEARNING_SECTION_KEYS = ("probe", "output", "concept")


def talk_library_file():
    return current_app.config["TALK_LIBRARY_FILE"]


def load_talk_library():
    path = talk_library_file()
    if not path.exists():
        return {"learning_calls": {}}
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        return {"learning_calls": {}}
    data.setdefault("learning_calls", {})
    return data


def save_talk_library(data):
    path = talk_library_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def normalize_learning_call(payload):
    title = str(payload.get("title") or "").strip()
    if title not in LEARNING_CALL_TITLES:
        return None

    return {
        "title": title,
        "probe": str(payload.get("probe") or "").strip(),
        "output": str(payload.get("output") or "").strip(),
        "concept": str(payload.get("concept") or "").strip(),
        "updated_by": g.user.get("username", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def public_learning_call(call):
    return {
        "title": call.get("title", ""),
        "probe": call.get("probe", ""),
        "output": call.get("output", ""),
        "concept": call.get("concept", ""),
        "updated_by": call.get("updated_by", ""),
        "updated_at": call.get("updated_at", ""),
    }


@talk_library_bp.get("/learning-calls")
@login_required
def get_learning_calls():
    data = load_talk_library()
    calls = {
        title: public_learning_call(call)
        for title, call in data.get("learning_calls", {}).items()
        if title in LEARNING_CALL_TITLES and isinstance(call, dict)
    }
    return jsonify({"calls": calls})


@talk_library_bp.put("/learning-calls")
@login_required
def save_learning_call():
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以维护学情电话话术。"}), 403

    payload = request.get_json(silent=True) or {}
    call = normalize_learning_call(payload)
    if call is None:
        return jsonify({"error": "请选择正确的通话类型。"}), 400
    if not any(call[key] for key in LEARNING_SECTION_KEYS):
        return jsonify({"error": "请至少填写一项学情电话内容。"}), 400

    data = load_talk_library()
    data.setdefault("learning_calls", {})[call["title"]] = call
    save_talk_library(data)
    return jsonify({"call": public_learning_call(call)})
