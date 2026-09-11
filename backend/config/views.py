from django.conf import settings
from django.db import connection
from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.http import require_safe


@require_safe
def frontend(request):
    try:
        response = FileResponse(
            (settings.FRONTEND_DIST / "index.html").open("rb"),
            content_type="text/html; charset=utf-8",
        )
    except FileNotFoundError as exc:
        raise Http404("Build the frontend before starting the combined server.") from exc
    response["Cache-Control"] = "no-cache"
    return response


@require_safe
def health(request):
    # Check database connectivity as well as the HTTP process.
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return JsonResponse({"status": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})
