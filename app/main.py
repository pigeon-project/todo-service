from wsgiref.simple_server import make_server
import os

from . import db
from .server import app as wsgi_app


def run():
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    db.init_db()
    with make_server(host, port, wsgi_app) as httpd:
        print(f"Serving on http://{host}:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    run()

