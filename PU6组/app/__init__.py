import os
from datetime import timedelta
from pathlib import Path

from flask import Flask


def create_app():
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev-secret-key-change-before-production"),
        USERS_FILE=Path(app.instance_path) / "users.json",
        CLASSES_FILE=Path(app.instance_path) / "classes.json",
        COMPLETION_ASSIGNMENTS_FILE=Path(app.instance_path) / "completion_class_assignments.json",
        COMPLETION_SNAPSHOTS_FILE=Path(app.instance_path) / "completion_snapshots.json",
        COMPLETION_REMINDER_ACTIONS_FILE=Path(app.instance_path) / "completion_reminder_actions.json",
        DAILY_REPORT_FILE=Path(app.instance_path) / "daily_reports.json",
        DATABASE_SETTINGS_FILE=Path(app.instance_path) / "database_settings.json",
        TALK_LIBRARY_FILE=Path(app.instance_path) / "talk_library.json",
        VIDEOS_FILE=Path(app.instance_path) / "videos.json",
        VIDEO_DOWNLOAD_DIR=Path(app.instance_path) / "video_downloads",
        PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    )
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)

    from app.auth import auth_bp, register_cli_commands
    from app.classes import classes_bp
    from app.database import database_bp
    from app.daily import daily_bp
    from app.routes import main_bp
    from app.talk_library import talk_library_bp
    from app.videos import videos_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(classes_bp)
    app.register_blueprint(database_bp)
    app.register_blueprint(daily_bp)
    app.register_blueprint(talk_library_bp)
    app.register_blueprint(videos_bp)
    app.register_blueprint(main_bp)
    register_cli_commands(app)
    return app
