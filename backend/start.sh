#!/bin/sh
set -eu

python manage.py migrate --noinput
if [ "${DJANGO_DATABASE_CACHE:-false}" = "true" ]; then
    python manage.py createcachetable
fi
# Seed only an empty catalogue; later deploys preserve administrator edits.
python manage.py shell -c 'from django.conf import settings; from django.core.management import call_command; from projects.models import Project; call_command("seed_projects") if settings.DEMO_MODE and not Project.objects.exists() else None'

exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-10000}" --workers "${WEB_CONCURRENCY:-2}" --threads 2 --timeout 120 --access-logfile - --error-logfile -
