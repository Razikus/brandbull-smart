FROM python:3.12-slim

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && rm -rf /root/.cache/pip && rm -rf /var/lib/apt/lists/*

COPY api /app/api

WORKDIR /app

ENTRYPOINT ["uvicorn", "api.main:app", "--host", "0.0.0.0"]