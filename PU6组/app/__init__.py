import json
import os
from datetime import timedelta
from pathlib import Path

from flask import Flask


INSTANCE_JSON_DEFAULTS = {
    "USERS_FILE": {},
    "CLASSES_FILE": {"classes": []},
    "COMPLETION_ACTIVITIES_FILE": {"activities": []},
    "COMPLETION_ASSIGNMENTS_FILE": {"classes": []},
    "COMPLETION_SNAPSHOTS_FILE": {"snapshots": {}, "last_month": {}},
    "COMPLETION_REMINDER_ACTIONS_FILE": {"records": []},
    "COMPLETION_REMINDER_PLANS_FILE": {"plans": {}},
    "DAILY_REPORT_FILE": {"reports": {}},
    "DATABASE_SETTINGS_FILE": {"learning": {"classes": {}, "teachers": {}}, "gmv": {}},
    "MONTHLY_ARCHIVES_FILE": {"archives": {}},
    "RENEWAL_PROJECTS_FILE": {"projects": [], "blocker_options": []},
    "TALK_LIBRARY_FILE": {"learning_calls": {}},
    "VIDEOS_FILE": {"records": []},
}


def clone_default_data(default):
    return json.loads(json.dumps(default, ensure_ascii=False))


def create_json_file_if_missing(path, default):
    path = Path(path)
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f"{path.suffix}.tmp")
    with temp_path.open("w", encoding="utf-8") as file:
        json.dump(clone_default_data(default), file, ensure_ascii=False, indent=2)
    temp_path.replace(path)


def ensure_instance_data_files(app):
    for config_key, default in INSTANCE_JSON_DEFAULTS.items():
        create_json_file_if_missing(app.config[config_key], default)


def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-key-change-before-production"),
        USERS_FILE=Path(app.instance_path) / "users.json",
        CLASSES_FILE=Path(app.instance_path) / "classes.json",
        COMPLETION_ACTIVITIES_FILE=Path(app.instance_path) / "completion_activities.json",
        COMPLETION_ACTIVITY_ASSET_DIR=Path(app.instance_path) / "completion_activity_assets",
        COMPLETION_ASSIGNMENTS_FILE=Path(app.instance_path) / "completion_class_assignments.json",
        COMPLETION_SNAPSHOTS_FILE=Path(app.instance_path) / "completion_snapshots.json",
        COMPLETION_REMINDER_ACTIONS_FILE=Path(app.instance_path) / "completion_reminder_actions.json",
        COMPLETION_REMINDER_PLANS_FILE=Path(app.instance_path) / "completion_reminder_plans.json",
        DAILY_REPORT_FILE=Path(app.instance_path) / "daily_reports.json",
        DATABASE_SETTINGS_FILE=Path(app.instance_path) / "database_settings.json",
        MONTHLY_ARCHIVES_FILE=Path(app.instance_path) / "monthly_archives.json",
        RENEWAL_PROJECTS_FILE=Path(app.instance_path) / "renewal_projects.json",
        TALK_LIBRARY_FILE=Path(app.instance_path) / "talk_library.json",
        VIDEOS_FILE=Path(app.instance_path) / "videos.json",
        VIDEO_DOWNLOAD_DIR=Path(app.instance_path) / "video_downloads",
        PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    )
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    ensure_instance_data_files(app)

    from app.auth import auth_bp, register_cli_commands
    from app.classes import classes_bp
    from app.database import database_bp
    from app.daily import daily_bp
    from app.renewal import renewal_bp
    from app.routes import main_bp
    from app.talk_library import talk_library_bp
    from app.videos import videos_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(classes_bp)
    app.register_blueprint(database_bp)
    app.register_blueprint(daily_bp)
    app.register_blueprint(renewal_bp)
    app.register_blueprint(talk_library_bp)
    app.register_blueprint(videos_bp)
    app.register_blueprint(main_bp)
    register_cli_commands(app)
    return app
