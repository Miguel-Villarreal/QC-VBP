# Stage 1: Build Next.js static site
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ .
ENV NEXT_PUBLIC_API_URL=""
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim
WORKDIR /app

# Install uv
RUN pip install uv

# Copy backend
COPY backend/ ./backend/
WORKDIR /app/backend
RUN uv pip install --system -r requirements.txt

# Copy static frontend build
COPY --from=frontend-build /app/frontend/out ./static

# Create data and uploads directories
RUN mkdir -p /app/backend/data /app/backend/uploads

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser \
    && chown -R appuser:appuser /app/backend/data /app/backend/uploads
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/api/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
