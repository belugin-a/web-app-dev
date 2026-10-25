import json
import re
import secrets
import sqlite3
import uuid
from datetime import datetime, timedelta
from pathlib import Path

from flask import (
    Flask,
    abort,
    g,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
SESSION_DIR = BASE_DIR / "sessions"
DB_PATH = BASE_DIR / "requests.db"

SESSION_COOKIE = "sid"                   # в cookie только идентификатор сессии
SESSION_TTL_DAYS = 30                    # срок жизни сессии
SESSION_MAX_REQUESTS = 20                # сколько заявок помним в сессии
SID_RE = re.compile(r"^[A-Za-z0-9_-]{32,64}$")

MAX_FILE_SIZE = 1 * 1024 * 1024          # 1 МБ — файл плана
# Запас по размеру всего запроса: даём приложению самому разобрать файл
# и показать понятную ошибку с сохранёнными полями. Защита от гигантских тел — 8 МБ.
MAX_REQUEST_SIZE = 8 * 1024 * 1024
ALLOWED_EXTENSION = ".pdf"

# Имя: только буквы и пробелы, 2–60 символов (без цифр и знаков препинания).
NAME_RE = re.compile(r"^[А-Яа-яЁёA-Za-z ]{2,60}$")
# Телефон: цифры, необязательный ведущий «+», пробелы, скобки, тире.
PHONE_CHARS_RE = re.compile(r"^\+?[\d\s()-]+$")
# E-mail: обязателен домен минимум второго уровня (точка + TLD от 2 букв).
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_SIZE


# ---------- шаблонные фильтры ----------

@app.template_filter("dt")
def format_datetime(value: str) -> str:
    """ISO-строку из базы показываем как 25.10.2026, 14:35."""
    try:
        return datetime.fromisoformat(value).strftime("%d.%m.%Y, %H:%M")
    except (TypeError, ValueError):
        return value


@app.template_filter("filesize")
def format_filesize(size: int | None) -> str:
    if not size:
        return "—"
    if size < 1024:
        return f"{size} Б"
    return f"{size / 1024:.0f} КБ"


# ---------- сессии (свой sid + JSON-файл в sessions/) ----------

def _session_file(sid: str) -> Path:
    return SESSION_DIR / f"{sid}.json"


def _read_session(sid: str) -> dict | None:
    """Читает файл сессии; None — если файла нет, он битый или срок вышел."""
    try:
        data = json.loads(_session_file(sid).read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("requests"), list):
            return None
        if datetime.fromisoformat(data["expires_at"]) <= datetime.now():
            return None
        return data
    except (OSError, ValueError, KeyError, TypeError):
        return None


def load_session() -> dict:
    """Возвращает сессию из cookie или новую (файл пишется только при изменениях)."""
    sid = request.cookies.get(SESSION_COOKIE, "")
    if SID_RE.fullmatch(sid):
        data = _read_session(sid)
        if data is not None:
            return {
                "sid": sid,
                "created_at": data.get("created_at", ""),
                "expires_at": data["expires_at"],
                "requests": data["requests"],
            }

    now = datetime.now()
    return {
        "sid": secrets.token_urlsafe(32),
        "created_at": now.isoformat(timespec="seconds"),
        "expires_at": (now + timedelta(days=SESSION_TTL_DAYS)).isoformat(timespec="seconds"),
        "requests": [],
    }


def cleanup_sessions() -> None:
    """Удаляет просроченные и повреждённые файлы сессий при старте."""
    SESSION_DIR.mkdir(exist_ok=True)
    for path in SESSION_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            expired = datetime.fromisoformat(data["expires_at"]) <= datetime.now()
            if expired:
                path.unlink(missing_ok=True)
        except (OSError, ValueError, KeyError, TypeError):
            path.unlink(missing_ok=True)


def session_owns(request_id: int) -> bool:
    """Заявка доступна, только если её id записан в текущей сессии."""
    return any(
        str(item.get("id")) == str(request_id)
        for item in g.session.get("requests", [])
        if isinstance(item, dict)
    )


@app.before_request
def open_session() -> None:
    g.session = load_session()
    g.session_dirty = False


@app.after_request
def persist_session(response):
    """Сохраняем сессию и ставим cookie только когда она изменилась."""
    if not getattr(g, "session_dirty", False):
        return response

    sess = g.session
    payload = {
        "created_at": sess["created_at"],
        "expires_at": sess["expires_at"],
        "requests": sess["requests"][-SESSION_MAX_REQUESTS:],
    }
    SESSION_DIR.mkdir(exist_ok=True)
    path = _session_file(sess["sid"])
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)

    response.set_cookie(
        SESSION_COOKIE,
        sess["sid"],
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        samesite="Lax",
        path="/",
    )
    return response


@app.context_processor
def inject_session_notice():
    """Последняя заявка текущей сессии — для сообщения на главной и форме."""
    requests = g.session.get("requests", []) if hasattr(g, "session") else []
    return {"my_request": requests[-1] if requests else None}


# ---------- база (таблица заявок) ----------

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS requests (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at    TEXT    NOT NULL,
                name          TEXT    NOT NULL,
                phone         TEXT    NOT NULL,
                email         TEXT    NOT NULL,
                comment       TEXT    NOT NULL DEFAULT '',
                file_stored   TEXT,
                file_original TEXT,
                file_size     INTEGER
            )
            """
        )


def save_request(fields: dict, file_info: dict | None) -> tuple[int, str]:
    """Сохраняет заявку и возвращает её id и время создания."""
    created_at = datetime.now().isoformat(timespec="seconds")
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO requests
                (created_at, name, phone, email, comment,
                 file_stored, file_original, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                fields["name"],
                fields["phone"],
                fields["email"],
                fields["comment"],
                file_info["stored_name"] if file_info else None,
                file_info["original_name"] if file_info else None,
                file_info["size"] if file_info else None,
            ),
        )
        return int(cur.lastrowid), created_at


# ---------- валидация ----------

def normalize_phone(raw: str) -> str:
    """Оставляем только цифры и приводим к виду +7XXXXXXXXXX, если это возможно."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 11 and digits[0] in "78":
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    return "+" + digits


def validate_file(storage) -> tuple[dict | None, str | None]:
    """Проверяет PDF и возвращает данные файла либо текст ошибки."""
    if storage is None or not storage.filename:
        return None, None                       # файл не обязателен

    original = storage.filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if not original:
        return None, "Не удалось прочитать имя файла."
    if len(original) > 200:
        return None, "Слишком длинное имя файла."
    if Path(original).suffix.lower() != ALLOWED_EXTENSION:
        return None, "Принимаем только файлы PDF."

    data = storage.read(MAX_FILE_SIZE + 1)
    if not data:
        return None, "Файл пустой."
    if len(data) > MAX_FILE_SIZE:
        return None, "Файл больше 1 МБ."
    if not data.startswith(b"%PDF-"):
        return None, "Файл не похож на PDF: неверная сигнатура."

    return {
        "data": data,
        "size": len(data),
        "original_name": original,
        "stored_name": uuid.uuid4().hex + ALLOWED_EXTENSION,
    }, None


def validate_form(form: dict, file_storage) -> tuple[dict, dict, dict | None]:
    """Возвращает (очищенные поля, ошибки, данные файла)."""
    errors: dict[str, str] = {}

    name = " ".join(form.get("name", "").split())
    if not NAME_RE.match(name):
        errors["name"] = "Имя: только буквы и пробелы, от 2 до 60 символов."

    raw_phone = form.get("phone", "").strip()
    digits = re.sub(r"\D", "", raw_phone)
    if not raw_phone:
        errors["phone"] = "Укажите телефон."
    elif not PHONE_CHARS_RE.match(raw_phone):
        errors["phone"] = "Телефон: допустимы цифры, «+», пробелы, скобки и тире."
    elif not 9 <= len(digits) <= 15:
        errors["phone"] = "Телефон: нужно от 9 до 15 цифр."

    email = form.get("email", "").strip().lower()
    if not email:
        errors["email"] = "Укажите e-mail."
    elif len(email) > 120 or not EMAIL_RE.match(email):
        errors["email"] = "E-mail: проверьте формат, например name@example.ru."

    comment = form.get("comment", "").strip()
    if len(comment) > 1000:
        errors["comment"] = "Комментарий: не больше 1000 символов."
    elif "<" in comment or ">" in comment:
        errors["comment"] = "Комментарий: только обычный текст, без HTML-тегов и кода."
    elif any(ord(ch) < 32 and ch not in "\n\r\t" for ch in comment):
        errors["comment"] = "Комментарий: недопустимые управляющие символы."

    file_info, file_error = validate_file(file_storage)
    if file_error:
        errors["plan"] = file_error

    fields = {
        "name": name,
        "phone": raw_phone,          # нормализуем только при сохранении
        "email": email,
        "comment": comment,
    }
    return fields, errors, file_info


# ---------- маршруты ----------

@app.get("/")
def index():
    return render_template("index.html")


@app.route("/request", methods=["GET", "POST"])
def request_page():
    if request.method == "GET":
        return render_template(
            "request.html",
            form={"name": "", "phone": "", "email": "", "comment": ""},
            errors={},
        )

    fields, errors, file_info = validate_form(request.form, request.files.get("plan"))
    if errors:
        return render_template("request.html", form=fields, errors=errors), 200

    fields["phone"] = normalize_phone(fields["phone"])

    if file_info:
        UPLOAD_DIR.mkdir(exist_ok=True)
        (UPLOAD_DIR / file_info["stored_name"]).write_bytes(file_info["data"])

    request_id, created_at = save_request(fields, file_info)

    # запоминаем заявку в сессии: id, время и имя (телефон, почта и комментарий — нет)
    requests_list = [
        item for item in g.session["requests"]
        if isinstance(item, dict) and str(item.get("id")) != str(request_id)
    ]
    requests_list.append(
        {"id": request_id, "created_at": created_at, "name": fields["name"]}
    )
    g.session["requests"] = requests_list[-SESSION_MAX_REQUESTS:]
    g.session_dirty = True

    return redirect(url_for("success", request_id=request_id), code=303)


@app.post("/reset")
def reset_session():
    """Забыть заявки: удаляем файл сессии и cookie."""
    _session_file(g.session["sid"]).unlink(missing_ok=True)
    response = redirect(url_for("index"), code=303)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@app.get("/success/<int:request_id>")
def success(request_id: int):
    if not session_owns(request_id):
        abort(404)                    # чужая заявка неотличима от несуществующей

    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM requests WHERE id = ?", (request_id,)
        ).fetchone()
    if row is None:
        abort(404)
    return render_template("success.html", item=row)


@app.get("/files/<int:request_id>")
def download_file(request_id: int):
    if not session_owns(request_id):
        abort(404)

    with get_db() as conn:
        row = conn.execute(
            "SELECT file_stored, file_original FROM requests WHERE id = ?",
            (request_id,),
        ).fetchone()
    if row is None or not row["file_stored"]:
        abort(404)
    return send_from_directory(
        UPLOAD_DIR,
        row["file_stored"],
        as_attachment=True,
        download_name=row["file_original"],
    )


@app.errorhandler(413)
def too_large(_error):
    return (
        render_template(
            "request.html",
            form={"name": "", "phone": "", "email": "", "comment": ""},
            errors={
                "plan": "Запрос слишком большой. Прикрепите PDF до 1 МБ "
                        "и заполните форму заново."
            },
        ),
        413,
    )


init_db()
cleanup_sessions()

if __name__ == "__main__":
    app.run(debug=True)
