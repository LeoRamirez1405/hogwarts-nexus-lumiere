FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip install --force-reinstall sqlalchemy-libsql==0.2.0

COPY . .

# Default: SQLite local. En produccion Render inyecta DATABASE_URL (Turso).
ENV DATABASE_URL=sqlite+aiosqlite:///./nexus.db

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
