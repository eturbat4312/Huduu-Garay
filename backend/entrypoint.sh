#!/bin/sh

echo "⏳ Waiting for PostgreSQL at db:5432..."

while ! nc -z db 5432; do
  sleep 0.5
done

echo "✅ PostgreSQL is up - starting Django..."

python manage.py migrate
python manage.py collectstatic --noinput
exec python manage.py runserver 0.0.0.0:8010
