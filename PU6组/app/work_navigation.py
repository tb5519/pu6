import json
import uuid
from datetime import datetime, timezone
from threading import Lock
from urllib.parse import urlparse

from flask import Blueprint, current_app, g, jsonify, request

from app.auth import can_manage_accounts, login_required


work_navigation_bp = Blueprint("work_navigation", __name__, url_prefix="/api/work-navigation")
WORK_NAV_LOCK = Lock()


def work_navigation_file():
    return current_app.config["WORK_NAVIGATION_FILE"]


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def load_work_navigation():
    path = work_navigation_file()
    if not path.exists():
        return {"links": []}
    with path.open("r", encoding="utf-8") as file:
        data = json.load(file)
    if not isinstance(data, dict):
        return {"links": []}
    data.setdefault("links", [])
    return data


def save_work_navigation(data):
    path = work_navigation_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
    temp_path.replace(path)


def normalize_url(value):
    url = str(value or "").strip()
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    return url


def normalize_link(link):
    if not isinstance(link, dict):
        return None
    link_id = str(link.get("id") or "").strip()
    title = str(link.get("title") or "").strip()
    url = normalize_url(link.get("url"))
    if not link_id or not title or not url:
        return None
    return {
        "id": link_id,
        "title": title[:80],
        "url": url,
        "keywords": str(link.get("keywords") or "").strip()[:160],
        "description": str(link.get("description") or "").strip()[:240],
        "is_open": bool(link.get("is_open", True)),
        "created_by": str(link.get("created_by") or "").strip(),
        "created_at": str(link.get("created_at") or "").strip(),
        "updated_by": str(link.get("updated_by") or "").strip(),
        "updated_at": str(link.get("updated_at") or "").strip(),
    }


def normalized_links(data):
    links = []
    for link in data.get("links", []):
        item = normalize_link(link)
        if item is not None:
            links.append(item)
    links.sort(key=lambda item: (not item.get("is_open", True), item.get("title", "")))
    return links


def serialize_link(link):
    item = normalize_link(link)
    if item is None:
        return None
    return {
        **item,
        "can_manage": can_manage_accounts(),
    }


def normalize_payload(payload, existing=None):
    existing = existing or {}
    title = str(payload.get("title") or "").strip()
    url = normalize_url(payload.get("url"))
    if not title:
        return None, "请填写链接名称。"
    if not url:
        return None, "请填写正确的工作链接，需要以 http:// 或 https:// 开头。"

    created_at = existing.get("created_at") or now_iso()
    created_by = existing.get("created_by") or str(g.user.get("username") or "")
    return {
        "id": existing.get("id") or uuid.uuid4().hex,
        "title": title[:80],
        "url": url,
        "keywords": str(payload.get("keywords") or "").strip()[:160],
        "description": str(payload.get("description") or "").strip()[:240],
        "is_open": bool(payload.get("is_open", True)),
        "created_by": created_by,
        "created_at": created_at,
        "updated_by": str(g.user.get("username") or ""),
        "updated_at": now_iso(),
    }, ""


@work_navigation_bp.get("")
@login_required
def get_work_navigation():
    can_manage = can_manage_accounts()
    data = load_work_navigation()
    links = [
        serialize_link(link)
        for link in normalized_links(data)
        if can_manage or link.get("is_open", True)
    ]
    return jsonify({
        "links": [link for link in links if link is not None],
        "can_manage": can_manage,
    })


@work_navigation_bp.post("")
@login_required
def create_work_link():
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以新增工作导航链接。"}), 403

    payload = request.get_json(silent=True) or {}
    link, error = normalize_payload(payload)
    if error:
        return jsonify({"error": error}), 400

    with WORK_NAV_LOCK:
        data = load_work_navigation()
        links = normalized_links(data)
        links.append(link)
        data["links"] = links
        save_work_navigation(data)
    return jsonify({"link": serialize_link(link)}), 201


@work_navigation_bp.put("/<link_id>")
@login_required
def update_work_link(link_id):
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以修改工作导航链接。"}), 403

    payload = request.get_json(silent=True) or {}
    with WORK_NAV_LOCK:
        data = load_work_navigation()
        links = normalized_links(data)
        existing = next((link for link in links if link.get("id") == link_id), None)
        if existing is None:
            return jsonify({"error": "工作链接不存在。"}), 404
        next_link, error = normalize_payload(payload, existing)
        if error:
            return jsonify({"error": error}), 400
        data["links"] = [next_link if link.get("id") == link_id else link for link in links]
        save_work_navigation(data)
    return jsonify({"link": serialize_link(next_link)})


@work_navigation_bp.delete("/<link_id>")
@login_required
def delete_work_link(link_id):
    if not can_manage_accounts():
        return jsonify({"error": "只有Joanna账号可以删除工作导航链接。"}), 403

    with WORK_NAV_LOCK:
        data = load_work_navigation()
        links = normalized_links(data)
        next_links = [link for link in links if link.get("id") != link_id]
        if len(next_links) == len(links):
            return jsonify({"error": "工作链接不存在。"}), 404
        data["links"] = next_links
        save_work_navigation(data)
    return jsonify({"ok": True})
