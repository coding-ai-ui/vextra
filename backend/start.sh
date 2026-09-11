#!/bin/sh
set -eu

python manage.py migrate --noinput
if [ "${DJANGO_DATABASE_CACHE:-false}" = "true" ]; then
    python manage.py createcachetable
fi
# Seed only an empty catalogue; later deploys preserve administrator edits.
python manage.py shell -c 'from django.conf import settings; from django.core.management import call_command; from projects.models import Project; call_command("seed_projects") if settings.DEMO_MODE and not Project.objects.exists() else None'

# Explicitly opt in through private runtime settings; never reset an existing user.
if [ -n "${ADMIN_INITIAL_PASSWORD:-}" ]; then
    if [ -z "${ADMIN_EMAIL:-}" ]; then
        printf '%s\n' 'Set ADMIN_EMAIL alongside ADMIN_INITIAL_PASSWORD for administrator setup.' >&2
        exit 1
    fi
    python manage.py create_admin --if-missing
fi

exec gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-10000}" --workers "${WEB_CONCURRENCY:-2}" --threads 2 --timeout 120 --access-logfile - --error-logfile -
