FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Copy only the dependency manifests first so these layers stay cached
# across code changes (faster, lighter rebuilds).
COPY requirements.txt requirements-audio.txt ./

RUN pip install --no-cache-dir --upgrade pip

# Split the install into two layers to keep the peak build memory low on
# Render Free. Each layer that succeeds is cached, so retries are cheap and,
# if one fails, the log points at exactly which group did it.
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r requirements-audio.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
