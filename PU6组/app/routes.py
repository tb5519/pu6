from flask import Blueprint, g, render_template

from app.auth import login_required


main_bp = Blueprint("main", __name__)
TALK_LIBRARY_MANAGER_ROLES = {"leader", "admin", "manager"}


@main_bp.get("/")
@login_required
def index():
    can_manage_talk_library = g.user.get("role") in TALK_LIBRARY_MANAGER_ROLES
    return render_template(
        "index.html",
        user=g.user,
        can_manage_talk_library=can_manage_talk_library,
    )
