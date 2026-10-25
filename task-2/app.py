import re
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from flask import (
    Flask,
    abort,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
DB_PATH = BASE_DIR / "requests.db"

MAX_FILE_SIZE = 1 * 1024 * 1024          # 1 МБ — файл плана
MAX_REQUEST_SIZE = 2 * 1024 * 1024       # 2 МБ — весь запрос (файл + поля)
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


def save_request(fields: dict, file_info: dict | None) -> int:
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO requests
                (created_at, name, phone, email, comment,
                 file_stored, file_original, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now().isoformat(timespec="seconds"),
                fields["name"],
                fields["phone"],
                fields["email"],
                fields["comment"],
                file_info["stored_name"] if file_info else None,
                file_info["original_name"] if file_info else None,
                file_info["size"] if file_info else None,
            ),
        )
        return int(cur.lastrowid)


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

    request_id = save_request(fields, file_info)
    return redirect(url_for("success", request_id=request_id), code=303)


@app.get("/success/<int:request_id>")
def success(request_id: int):
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM requests WHERE id = ?", (request_id,)
        ).fetchone()
    if row is None:
        abort(404)
    return render_template("success.html", item=row)


@app.get("/files/<int:request_id>")
def download_file(request_id: int):
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
            errors={"plan": "Файл слишком большой: не больше 1 МБ."},
        ),
        413,
    )


init_db()

if __name__ == "__main__":
    app.run(debug=True)
