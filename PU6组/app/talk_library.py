import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from app.auth import can_manage_accounts, login_required


talk_library_bp = Blueprint("talk_library", __name__, url_prefix="/api/talk-library")

LEARNING_CALL_TITLES = ["首通电话", "第二通电话", "第三通电话", "第四通电话", "第五通电话"]
LEARNING_SECTION_KEYS = ("probe", "output", "concept")
TALK_MATERIAL_CATEGORIES = {"续费", "转介绍", "学情", "挽单"}
TALK_MATERIAL_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
TALK_TRACK_CATEGORIES = {"续费", "转介绍", "学情", "挽单"}
RENEWAL_TALK_TYPES = {"问答话术", "留言推荐"}


def talk_library_file():
    return current_app.config["TALK_LIBRARY_FILE"]


def talk_material_dir():
    return Path(current_app.config["TALK_MATERIAL_DIR"])


def load_talk_library():
    path = talk_library_file()
    if not path.exists():
        return {"learning_calls": {}, "materials": [], "tracks": []}
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        return {"learning_calls": {}, "materials": [], "tracks": []}
    data.setdefault("learning_calls", {})
    data.setdefault("materials", [])
    data.setdefault("tracks", [])
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


def normalize_talk_category(value):
    category = str(value or "").strip()
    return category if category in TALK_TRACK_CATEGORIES else "续费"


def normalize_renewal_talk_type(value):
    talk_type = str(value or "").strip()
    return talk_type if talk_type in RENEWAL_TALK_TYPES else "问答话术"


def normalize_talk_track(track):
    if not isinstance(track, dict):
        return None
    text = str(
        track.get("text")
        or track.get("标准话术")
        or track.get("talktrack")
        or track.get("answer")
        or ""
    ).strip()
    if not text:
        return None
    category = normalize_talk_category(track.get("category") or track.get("分类"))
    track_id = str(track.get("id") or "").strip() or uuid.uuid4().hex
    try:
        priority = int(track.get("priority") or track.get("优先级") or 10)
    except (TypeError, ValueError):
        priority = 10
    output = {
        "id": track_id,
        "category": category,
        "type": normalize_renewal_talk_type(track.get("type") or track.get("类型")) if category == "续费" else "",
        "scene": str(track.get("scene") or track.get("场景") or track.get("问题示例") or "").strip()[:120],
        "keywords": str(track.get("keywords") or track.get("关键词") or "").strip()[:200],
        "example": str(track.get("example") or track.get("问题示例") or "").strip()[:180],
        "text": text[:5000],
        "priority": priority,
        "created_by": str(track.get("created_by") or track.get("创建人") or "").strip(),
        "created_at": str(track.get("created_at") or "").strip(),
        "updated_at": str(track.get("updated_at") or "").strip(),
    }
    if not output["scene"]:
        output["scene"] = output["example"] or output["keywords"] or ("留言话术" if output["type"] == "留言推荐" else "新增话术")
    return output


def public_talk_track(track):
    item = normalize_talk_track(track)
    if item is None:
        return None
    return {
        **item,
        "can_delete": can_manage_accounts(),
    }


def normalized_talk_tracks(data):
    tracks = []
    for track in data.get("tracks", []):
        item = normalize_talk_track(track)
        if item is not None:
            tracks.append(item)
    tracks.sort(key=lambda item: (item.get("created_at") or "", item.get("priority") or 0), reverse=True)
    return tracks


def normalize_material_category(value):
    category = str(value or "").strip()
    return category if category in TALK_MATERIAL_CATEGORIES else "续费"


def normalize_material(material):
    if not isinstance(material, dict):
        return None
    material_id = str(material.get("id") or "").strip()
    filename = str(material.get("filename") or "").strip()
    if not material_id or not filename:
        return None
    title = str(material.get("title") or "").strip() or str(material.get("original_filename") or "").strip() or "素材"
    category = normalize_material_category(material.get("category"))
    return {
        "id": material_id,
        "title": title[:80],
        "category": category,
        "keywords": str(material.get("keywords") or "").strip()[:160],
        "note": str(material.get("note") or "").strip()[:240],
        "filename": filename,
        "original_filename": str(material.get("original_filename") or "").strip(),
        "mime_type": str(material.get("mime_type") or "").strip(),
        "size": int(material.get("size") or 0),
        "uploaded_by": str(material.get("uploaded_by") or "").strip(),
        "uploaded_at": str(material.get("uploaded_at") or "").strip(),
    }


def public_material(material):
    item = normalize_material(material)
    if item is None:
        return None
    return {
        **item,
        "can_delete": can_manage_accounts(),
        "url": f"/api/talk-library/materials/{item['id']}/file",
    }


def normalized_materials(data):
    materials = []
    for material in data.get("materials", []):
        item = normalize_material(material)
        if item is not None:
            materials.append(item)
    materials.sort(key=lambda item: item.get("uploaded_at") or "", reverse=True)
    return materials


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


@talk_library_bp.get("/tracks")
@login_required
def get_talk_tracks():
    data = load_talk_library()
    tracks = [
        public_talk_track(track)
        for track in normalized_talk_tracks(data)
    ]
    return jsonify({"tracks": [track for track in tracks if track is not None]})


@talk_library_bp.post("/tracks")
@login_required
def create_talk_track():
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以新增话术。"}), 403

    payload = request.get_json(silent=True) or {}
    track = normalize_talk_track(payload)
    if track is None:
        return jsonify({"error": "请填写话术内容。"}), 400

    now = datetime.now(timezone.utc).isoformat()
    track["id"] = uuid.uuid4().hex
    track["created_by"] = str(g.user.get("username") or "")
    track["created_at"] = now
    track["updated_at"] = now

    data = load_talk_library()
    tracks = normalized_talk_tracks(data)
    tracks.insert(0, track)
    data["tracks"] = tracks
    save_talk_library(data)
    return jsonify({
        "track": public_talk_track(track),
        "tracks": [public_talk_track(item) for item in normalized_talk_tracks(data)],
    })


@talk_library_bp.post("/tracks/import")
@login_required
def import_talk_tracks():
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以导入话术。"}), 403

    payload = request.get_json(silent=True) or {}
    raw_tracks = payload.get("tracks") if isinstance(payload.get("tracks"), list) else []
    replace_category = normalize_talk_category(payload.get("category"))
    should_replace_category = bool(payload.get("replace_category"))

    imported = []
    now = datetime.now(timezone.utc).isoformat()
    for raw_track in raw_tracks:
        track = normalize_talk_track(raw_track)
        if track is None:
            continue
        track["id"] = uuid.uuid4().hex
        track["created_by"] = str(g.user.get("username") or "")
        track["created_at"] = now
        track["updated_at"] = now
        imported.append(track)

    if not imported:
        return jsonify({"error": "没有读取到可导入的话术。"}), 400

    data = load_talk_library()
    tracks = normalized_talk_tracks(data)
    if should_replace_category:
        tracks = [track for track in tracks if normalize_talk_category(track.get("category")) != replace_category]
    data["tracks"] = [*imported, *tracks]
    save_talk_library(data)
    return jsonify({
        "imported_count": len(imported),
        "tracks": [public_talk_track(item) for item in normalized_talk_tracks(data)],
    })


@talk_library_bp.delete("/tracks/<track_id>")
@login_required
def delete_talk_track(track_id):
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以删除话术。"}), 403

    data = load_talk_library()
    tracks = normalized_talk_tracks(data)
    next_tracks = [track for track in tracks if track.get("id") != track_id]
    if len(next_tracks) == len(tracks):
        return jsonify({"error": "话术不存在。"}), 404
    data["tracks"] = next_tracks
    save_talk_library(data)
    return jsonify({"ok": True, "tracks": [public_talk_track(item) for item in normalized_talk_tracks(data)]})


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


@talk_library_bp.get("/materials")
@login_required
def get_talk_materials():
    data = load_talk_library()
    materials = [
        public_material(material)
        for material in normalized_materials(data)
    ]
    return jsonify({"materials": [material for material in materials if material is not None]})


@talk_library_bp.post("/materials")
@login_required
def upload_talk_material():
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以上传话术素材。"}), 403

    uploaded_file = request.files.get("file")
    if uploaded_file is None or not uploaded_file.filename:
        return jsonify({"error": "请选择要上传的素材图片。"}), 400

    raw_filename = str(uploaded_file.filename or "").strip()
    safe_filename = secure_filename(raw_filename)
    extension = Path(raw_filename).suffix.lower() or Path(safe_filename).suffix.lower()
    if extension not in TALK_MATERIAL_EXTENSIONS:
        return jsonify({"error": "目前仅支持 png、jpg、jpeg、webp、gif 图片素材。"}), 400

    material_id = uuid.uuid4().hex
    filename = f"{material_id}{extension}"
    material_path = talk_material_dir()
    material_path.mkdir(parents=True, exist_ok=True)
    target_path = material_path / filename
    uploaded_file.save(target_path)

    material = {
        "id": material_id,
        "title": str(request.form.get("title") or "").strip()[:80] or Path(raw_filename).stem[:80] or "素材",
        "category": "",
        "keywords": str(request.form.get("keywords") or "").strip()[:160],
        "note": "",
        "filename": filename,
        "original_filename": raw_filename[:160] or f"material{extension}",
        "mime_type": uploaded_file.mimetype or "",
        "size": target_path.stat().st_size if target_path.exists() else 0,
        "uploaded_by": str(g.user.get("username") or ""),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }

    data = load_talk_library()
    data.setdefault("materials", []).append(material)
    save_talk_library(data)
    return jsonify({"material": public_material(material)})


@talk_library_bp.get("/materials/<material_id>/file")
@login_required
def get_talk_material_file(material_id):
    data = load_talk_library()
    material = next(
        (item for item in normalized_materials(data) if item.get("id") == material_id),
        None,
    )
    if material is None:
        return jsonify({"error": "素材不存在。"}), 404
    return send_from_directory(talk_material_dir(), material["filename"])


@talk_library_bp.delete("/materials/<material_id>")
@login_required
def delete_talk_material(material_id):
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以删除话术素材。"}), 403

    data = load_talk_library()
    materials = normalized_materials(data)
    material = next((item for item in materials if item.get("id") == material_id), None)
    if material is None:
        return jsonify({"error": "素材不存在。"}), 404

    data["materials"] = [item for item in materials if item.get("id") != material_id]
    save_talk_library(data)

    target_path = talk_material_dir() / material["filename"]
    if target_path.exists():
        target_path.unlink()
    return jsonify({"ok": True})
