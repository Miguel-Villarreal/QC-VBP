#!/bin/bash
cd "$(dirname "$0")/.."
docker compose up -d --build
echo "QC Inspector running at http://localhost:8001"
