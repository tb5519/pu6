import json
import mimetypes
import re
import shutil
import ssl
import uuid
from datetime import datetime
from html import unescape as html_unescape
from pathlib import Path
from urllib.parse import parse_qsl, unquote, urlparse
from urllib.request import Request, urlopen

from flask import Blueprint, current_app, g, jsonify, request, send_from_directory

from app.auth import login_required

try:
    from yt_dlp import YoutubeDL
except ImportError:  # pragma: no cover - local installs should include yt-dlp.
    YoutubeDL = None


videos_bp = Blueprint("videos", __name__, url_prefix="/api/videos")

URL_RE = re.compile(r"(?:https?://|u\.lingshi)[^\s，,;；\"'<>\u4e00-\u9fff]+", re.IGNORECASE)
UNICODE_ESCAPE_RE = re.compile(r"\\u([0-9a-fA-F]{4})")
INVALID_FILENAME_RE = re.compile(r'[\\/:*?"<>|\r\n\t]+')
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv", ".flv", ".wmv"}
NAME_QUERY_KEYS = {
    "name",
    "student",
    "studentname",
    "student_name",
    "username",
    "user_name",
    "nickname",
    "title",
    "filename",
    "file_name",
    "videoname",
    "video_name",
}
GENERIC_NAME_PARTS = {
    "video",
    "videos",
    "download",
    "preview",
    "play",
    "source",
    "file",
    "media",
    "v",
    "mp4",
    "mov",
    "m3u8",
}


def videos_file():
    return current_app.config["VIDEOS_FILE"]


def download_root():
    path = current_app.config["VIDEO_DOWNLOAD_DIR"]
    path.mkdir(parents=True, exist_ok=True)
    return path


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def current_owner():
    return g.user["username"]


def load_store():
    path = videos_file()
    if not path.exists():
        return {"records": []}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_store(store):
    path = videos_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(store, file, ensure_ascii=False, indent=2)


def sanitize_filename(value):
    text = INVALID_FILENAME_RE.sub(" ", str(value or "")).strip()
    text = re.sub(r"\s+", " ", text)
    text = text.strip(". ")
    return text[:90] or "未命名视频"


def is_generic_name(value):
    text = re.sub(r"[\s_\-.]+", "", str(value or "").lower())
    if not text:
        return True
    if text in GENERIC_NAME_PARTS:
        return True
    if text.isdigit():
        return True
    if len(text) >= 16 and re.fullmatch(r"[a-f0-9]+", text):
        return True
    if len(text) >= 20 and re.fullmatch(r"[a-z0-9]+", text):
        return True
    return False


def clean_name_candidate(value):
    text = unquote(str(value or "")).strip()
    if not text or text.lower().startswith(("http://", "https://")):
        return ""

    text = text.split("#", 1)[0].split("?", 1)[0].strip()
    if "/" in text:
        text = text.rstrip("/").rsplit("/", 1)[-1]

    suffix = Path(text).suffix.lower()
    if suffix:
        text = Path(text).stem

    text = re.sub(r"(?i)\b(video|mp4|mov)\b", " ", text)
    text = re.sub(r"(优秀视频|视频|作品|作业|打卡|课堂表现)$", "", text).strip(" _-")
    text = sanitize_filename(text)
    return "" if is_generic_name(text) else text


def infer_name_from_url(url):
    parsed = urlparse(url)
    query_pairs = parse_qsl(parsed.query, keep_blank_values=False)

    for key, value in query_pairs:
        normalized_key = re.sub(r"[^a-z0-9_]+", "", key.lower())
        if normalized_key in NAME_QUERY_KEYS:
            candidate = clean_name_candidate(value)
            if candidate:
                return candidate

    for _, value in query_pairs:
        candidate = clean_name_candidate(value)
        if candidate and re.search(r"[\u4e00-\u9fff]", candidate):
            return candidate

    path_parts = [part for part in unquote(parsed.path or "").split("/") if part]
    for part in reversed(path_parts):
        candidate = clean_name_candidate(part)
        if candidate:
            return candidate

    return ""


def fallback_name_from_url(url):
    return sanitize_filename(infer_name_from_url(url) or "未命名视频")


def clean_pasted_url(url):
    text = html_unescape(str(url or "")).strip()
    text = text.rstrip("。).,，;；、\"'“”’】]}>")
    if re.match(r"^u\.lingshi", text, re.IGNORECASE):
        text = f"https://{text}"
    return text


def decode_unicode_escape(match):
    return chr(int(match.group(1), 16))


def normalize_link_text(value):
    text = html_unescape(str(value or ""))
    text = UNICODE_ESCAPE_RE.sub(decode_unicode_escape, text)
    replacements = {
        "：": ":",
        "／": "/",
        "？": "?",
        "＆": "&",
        "＝": "=",
        "\\/": "/",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"https?\s*:\s*/\s*/", lambda match: match.group(0).replace(" ", ""), text, flags=re.IGNORECASE)
    return text


def url_search_texts(raw_text):
    seen = set()
    queue = [str(raw_text or "")]
    outputs = []

    while queue and len(outputs) < 12:
        text = queue.pop(0)
        if text in seen:
            continue
        seen.add(text)
        normalized = normalize_link_text(text)
        outputs.append(normalized)

        decoded = unquote(normalized)
        if decoded != normalized and decoded not in seen:
            queue.append(decoded)

    return outputs


def unique_path(base_name, extension):
    clean_base = sanitize_filename(base_name)
    clean_extension = extension if extension.startswith(".") else f".{extension}"
    clean_extension = clean_extension.lower()
    target = download_root() / f"{clean_base}{clean_extension}"
    index = 2
    while target.exists():
        target = download_root() / f"{clean_base}-{index}{clean_extension}"
        index += 1
    return target


def parse_pasted_items(raw_text):
    items = []
    seen_urls = set()
    for text in url_search_texts(raw_text):
        for match in URL_RE.finditer(text):
            url = clean_pasted_url(match.group(0))
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            items.append({"student_name": infer_name_from_url(url), "url": url})
    return items


def extension_from_response(url, response):
    content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
    extension = mimetypes.guess_extension(content_type) if content_type else ""
    if extension:
        return extension

    suffix = Path(unquote(urlparse(url).path or "")).suffix
    return suffix if suffix else ".mp4"


def direct_download(url, base_name):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30, context=ssl._create_unverified_context()) as response:
        content_type = response.headers.get("Content-Type", "").split(";")[0].strip().lower()
        extension = extension_from_response(url, response)
        if not content_type.startswith("video/") and extension.lower() not in VIDEO_EXTENSIONS:
            raise RuntimeError("该链接不是可直接下载的视频文件。")
        target = unique_path(base_name, extension)
        with target.open("wb") as file:
            shutil.copyfileobj(response, file)
    return target


def find_downloaded_file(base_name, before_files):
    candidates = [
        path
        for path in download_root().glob(f"{sanitize_filename(base_name)}.*")
        if path not in before_files and path.is_file()
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda path: path.stat().st_mtime)


def ytdlp_download(url, student_name):
    if YoutubeDL is None:
        raise RuntimeError("下载组件未安装，请先安装 yt-dlp。")

    metadata_options = {
        "quiet": True,
        "noprogress": True,
        "no_warnings": True,
        "noplaylist": True,
        "nocheckcertificate": True,
        "socket_timeout": 20,
        "http_headers": {"User-Agent": "Mozilla/5.0"},
    }
    with YoutubeDL(metadata_options) as ydl:
        info = ydl.extract_info(url, download=False)

    title = sanitize_filename(student_name or info.get("title") or fallback_name_from_url(url))
    extension = str(info.get("ext") or "mp4").lower()
    target = unique_path(title, extension)
    base_name = target.stem
    before_files = set(download_root().glob("*"))

    download_options = {
        "quiet": True,
        "noprogress": True,
        "no_warnings": True,
        "noplaylist": True,
        "nocheckcertificate": True,
        "socket_timeout": 30,
        "http_headers": {"User-Agent": "Mozilla/5.0"},
        "outtmpl": str(download_root() / f"{base_name}.%(ext)s"),
        "format": "best[ext=mp4]/best",
    }
    with YoutubeDL(download_options) as ydl:
        downloaded_info = ydl.extract_info(url, download=True)
        prepared = Path(ydl.prepare_filename(downloaded_info))

    if prepared.exists():
        return prepared
    found = find_downloaded_file(base_name, before_files)
    if found:
        return found
    raise RuntimeError("视频下载完成后未找到文件。")


def download_video(url, student_name):
    if urlparse(url).scheme not in {"http", "https"}:
        raise ValueError("仅支持 http 或 https 视频链接。")

    base_name = sanitize_filename(student_name or fallback_name_from_url(url))
    try:
        return ytdlp_download(url, student_name)
    except Exception:
        return direct_download(url, base_name)


def serialize_record(record):
    output = dict(record)
    output["file_url"] = f"/api/videos/files/{record['id']}"
    return output


@videos_bp.get("")
@login_required
def list_videos():
    store = load_store()
    records = [
        serialize_record(record)
        for record in store.get("records", [])
        if record.get("owner") == current_owner()
    ]
    records.sort(key=lambda record: record.get("created_at", ""), reverse=True)
    return jsonify({"records": records})


@videos_bp.post("/download")
@login_required
def download_videos():
    data = request.get_json(silent=True) or {}
    items = parse_pasted_items(data.get("raw_text"))
    if not items:
        return jsonify({"error": "请先粘贴视频链接。"}), 400

    store = load_store()
    created_records = []
    errors = []

    for item in items:
        url = item["url"]
        student_name = item.get("student_name") or fallback_name_from_url(url)
        try:
            file_path = download_video(url, student_name)
        except Exception as error:
            errors.append({"url": url, "student_name": student_name, "error": str(error)})
            continue
        student_name = sanitize_filename(item.get("student_name") or file_path.stem or fallback_name_from_url(url))

        record = {
            "id": uuid.uuid4().hex,
            "owner": current_owner(),
            "student_name": sanitize_filename(student_name),
            "source_url": url,
            "filename": file_path.name,
            "size": file_path.stat().st_size,
            "created_at": now_iso(),
        }
        store.setdefault("records", []).append(record)
        created_records.append(serialize_record(record))

    save_store(store)
    return jsonify({"records": created_records, "errors": errors})


@videos_bp.get("/files/<record_id>")
@login_required
def download_file(record_id):
    store = load_store()
    record = next(
        (
            item
            for item in store.get("records", [])
            if item.get("id") == record_id and item.get("owner") == current_owner()
        ),
        None,
    )
    if record is None:
        return jsonify({"error": "视频不存在。"}), 404
    return send_from_directory(download_root(), record["filename"], as_attachment=True, download_name=record["filename"])
