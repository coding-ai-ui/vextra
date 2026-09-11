"""Exercise the production WSGI configuration using an isolated in-memory DB.

Run after npm run build and manage.py collectstatic:
    backend/venv/Scripts/python.exe scripts/check_deployment.py
"""
import os
from pathlib import Path
import re
import secrets
import sys
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))
os.environ.update({
    "DJANGO_SETTINGS_MODULE": "config.settings",
    "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
    "DJANGO_DEBUG": "False",
    "DJANGO_ALLOWED_HOSTS": "deployment.test",
    "RENDER_EXTERNAL_HOSTNAME": "deployment.test",
    "SERVE_FRONTEND": "true",
    "DJANGO_TRUST_PROXY": "true",
    "DJANGO_DATABASE_CACHE": "true",
    "DJANGO_SECURE_SSL_REDIRECT": "true",
    "DATABASE_URL": "sqlite:///:memory:",
    "VEXTRA_DEMO_MODE": "true",
})

import django
django.setup()
from django.core.management import call_command
from django.test import Client

call_command("migrate", interactive=False, verbosity=0)
call_command("createcachetable", verbosity=0)
call_command("seed_projects", verbosity=0)
client = Client(HTTP_HOST="deployment.test", HTTP_X_FORWARDED_PROTO="https")

for path in ("/", "/projects", "/projects/nova-energy", "/dashboard", "/admin", "/admin/users"):
    response = client.get(path)
    assert response.status_code == 200, (path, response.status_code)
    assert "text/html" in response["Content-Type"], path
    body = b"".join(response.streaming_content).decode()
    assert '<div id="root">' in body, path

html = (ROOT / "frontend/dist/index.html").read_text(encoding="utf-8")
for path in re.findall(r'(?:src|href)="(/[^\"]+)"', html):
    response = client.get(path)
    assert response.status_code == 200, (path, response.status_code)

assert client.get("/static/admin/css/base.css").status_code == 200
assert client.get("/django-admin/login/").status_code == 200
for path in ("/api/missing/", "/assets/missing.js", "/static/missing.css", "/.env"):
    assert client.get(path).status_code == 404, path
assert client.get("/api/health/").json() == {"status": "ok"}
with patch("config.views.connection.cursor", side_effect=RuntimeError("private database error")):
    response = client.get("/api/health/")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}

response = Client(HTTP_HOST="deployment.test").get("/projects")
assert response.status_code == 301
assert response["Location"] == "https://deployment.test/projects"

def post(path, data, token=None):
    headers = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
    return client.post(path, data, content_type="application/json", **headers)

password = secrets.token_urlsafe(24)
response = post("/api/users/register/", {
    "username": "deploycheck", "email": "deploycheck@example.test", "password": password,
})
assert response.status_code == 201, response.content
response = post("/api/users/login/", {"username": "deploycheck", "password": password})
assert response.status_code == 200, response.content
token = response.json()["access"]
project = next(p for p in client.get("/api/projects/").json() if p["title"] == "Nova Energy")
response = post("/api/investments/", {"project_id": project["id"], "amount": "1000.00"}, token)
assert response.status_code == 201, response.content
assert response.json()["expected_profit"] == "150.00"
assert client.get("/api/investments/").status_code == 401
response = client.get("/api/investments/", HTTP_AUTHORIZATION=f"Bearer {token}")
assert response.status_code == 200 and len(response.json()) == 1
print("PASS: production routing, built assets, HTTPS proxy, health, registration, login and saved portfolio.")
