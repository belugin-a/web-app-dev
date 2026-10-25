from flask import Flask, render_template

app = Flask(__name__)


@app.get("/")
def index():
    """Главная: услуги и CTA на форму."""
    return render_template("index.html")


@app.get("/request")
def request_page():
    """Страница заявки. Пока только показывает форму."""
    return render_template("request.html")


@app.get("/success")
def success():
    """Подтверждение. Пока заглушка без данных."""
    return render_template("success.html")


if __name__ == "__main__":
    app.run(debug=True)
