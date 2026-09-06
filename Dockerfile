FROM python:3.11-slim

WORKDIR /app

# Install minimal OS dependencies for geospatial & networking
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    libexpat1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*


# Install python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend source and AI surveillance pipeline + ONNX weights
COPY backend/ ./backend/
COPY ai-model/ ./ai-model/

# Ensure runtime output directory exists
RUN mkdir -p ai-model/outputs

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

WORKDIR /app/backend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]

