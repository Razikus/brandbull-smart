FROM python:3.12-slim

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt && rm -rf /root/.cache/pip && rm -rf /var/lib/apt/lists/*
COPY main.py /app/main.py

WORKDIR /app

ENTRYPOINT ["python", "-u", "main.py"]