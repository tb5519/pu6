from flask import Blueprint, g, render_template

from app.auth import login_required
from app.teachers import normalize_teacher_id, teacher_id_for_username


main_bp = Blueprint("main", __name__)
COMPLETION_UPLOAD_TEACHER_ID = "wenyun_joanna"


def current_teacher_id():
    return (
        normalize_teacher_id(g.user.get("teacher_id"))
        or normalize_teacher_id(g.user.get("username"))
        or teacher_id_for_username(g.user.get("username"))
    )


@main_bp.get("/")
@login_required
def index():
    can_upload_completion_data = current_teacher_id() == COMPLETION_UPLOAD_TEACHER_ID
    can_manage_accounts = can_upload_completion_data
    can_manage_talk_library = can_manage_accounts
    return render_template(
        "index.html",
        user=g.user,
        can_manage_talk_library=can_manage_talk_library,
        can_upload_completion_data=can_upload_completion_data,
        can_manage_accounts=can_manage_accounts,
    )
