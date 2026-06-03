import json
import re
from functools import wraps

import click
from flask import (
    Blueprint,
    current_app,
    g,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from werkzeug.security import check_password_hash, generate_password_hash


auth_bp = Blueprint("auth", __name__)
USERNAME_RE = re.compile(r"^[\w.\-\u4e00-\u9fff]{2,32}$")


def normalize_username(username):
    return username.strip().lower()


def validate_username(username):
    if not USERNAME_RE.fullmatch(username):
        raise click.ClickException("账号只能使用 2-32 位中文、英文字母、数字、下划线、点或横线。")


def users_file():
    return current_app.config["USERS_FILE"]


def load_users():
    path = users_file()
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_users(users):
    path = users_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(users, file, ensure_ascii=False, indent=2)


def get_user(username):
    if not username:
        return None
    return load_users().get(normalize_username(username))


def authenticate_user(username, password):
    user = get_user(username)
    if not user or not user.get("active", True):
        return None
    if not check_password_hash(user["password_hash"], password):
        return None
    return user


def login_required(view):
    @wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            return redirect(url_for("auth.login", next=request.path))
        return view(**kwargs)

    return wrapped_view


@auth_bp.before_app_request
def load_logged_in_user():
    g.user = get_user(session.get("username"))


@auth_bp.route("/login", methods=("GET", "POST"))
def login():
    if g.user is not None:
        return redirect(url_for("main.index"))

    error = None
    form_username = ""

    if request.method == "POST":
        form_username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        if not form_username or not password:
            error = "请输入账号和密码。"
        else:
            user = authenticate_user(form_username, password)
            if user is None:
                error = "账号或密码不正确，请检查后重试。"
            else:
                session.clear()
                session.permanent = request.form.get("remember") == "on"
                session["username"] = user["username"]

                next_url = request.args.get("next")
                if next_url and next_url.startswith("/") and not next_url.startswith("//"):
                    return redirect(next_url)
                return redirect(url_for("main.index"))

    return render_template("login.html", error=error, form_username=form_username)


@auth_bp.get("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


def add_user(username, password, display_name, role):
    username = normalize_username(username)
    validate_username(username)

    users = load_users()
    if username in users:
        raise click.ClickException(f"账号 {username} 已存在。")

    users[username] = {
        "username": username,
        "display_name": display_name.strip() or username,
        "role": role.strip() or "member",
        "active": True,
        "password_hash": generate_password_hash(password),
    }
    save_users(users)
    return users[username]


def reset_user_password(username, password):
    username = normalize_username(username)
    users = load_users()
    if username not in users:
        raise click.ClickException(f"账号 {username} 不存在。")

    users[username]["password_hash"] = generate_password_hash(password)
    users[username]["active"] = True
    save_users(users)


def prompt_password(password):
    if password:
        return password
    return click.prompt("密码", hide_input=True, confirmation_prompt=True)


def register_cli_commands(app):
    @app.cli.command("create-user")
    @click.argument("username")
    @click.option("--name", default="", help="成员显示名称。")
    @click.option("--role", default="member", help="成员角色，例如 leader 或 member。")
    @click.option("--password", default="", help="直接传入初始密码；留空则安全输入。")
    def create_user_command(username, name, role, password):
        """由组长创建一个可登录账号。"""
        user = add_user(username, prompt_password(password), name, role)
        click.echo(f"已创建账号：{user['username']}（{user['display_name']}）")

    @app.cli.command("reset-password")
    @click.argument("username")
    @click.option("--password", default="", help="直接传入新密码；留空则安全输入。")
    def reset_password_command(username, password):
        """由组长重置成员密码。"""
        reset_user_password(username, prompt_password(password))
        click.echo(f"已重置账号密码：{normalize_username(username)}")
