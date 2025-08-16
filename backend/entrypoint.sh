#!/usr/bin/env sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "⏳ Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
while ! nc -z "${DB_HOST}" "${DB_PORT}"; do
  sleep 0.5
done
echo "✅ PostgreSQL is up."

# Миграци / статик
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Gunicorn тохиргоо (env-ээр өөрчилж болно)
GUNICORN_WORKERS="${GUNICORN_WORKERS:-3}"
GUNICORN_THREADS="${GUNICORN_THREADS:-2}"
GUNICORN_TIMEOUT="${GUNICORN_TIMEOUT:-60}"

echo "🚀 Starting Gunicorn (${GUNICORN_WORKERS} workers, ${GUNICORN_THREADS} threads)..."
exec gunicorn huduu_garay.wsgi:application \
  --bind 0.0.0.0:8010 \
  --workers "${GUNICORN_WORKERS}" \
  --threads "${GUNICORN_THREADS}" \
  --timeout "${GUNICORN_TIMEOUT}" \
  --access-logfile - \
  --error-logfile -
