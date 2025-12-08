#!/bin/sh

# Django migrations and static files
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py create_superuser

# DEBUG 값 확인
DEBUG=$(python -c "from config.settings import DEBUG; print('true' if DEBUG else 'false')")

if [ "$DEBUG" = "true" ]; then
    echo "Running in DEBUG mode with Django development server..."
    python manage.py runserver 0.0.0.0:8000
else
    echo "Running in PRODUCTION mode with Gunicorn..."
    gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4 --timeout 120
fi