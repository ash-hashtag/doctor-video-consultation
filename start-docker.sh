#!/bin/bash

# Exit on error
set -e

echo "🐳 Starting Sehaat Saathi Video Consultation suite (Docker Fallback)..."

# 1. Create Docker Network
echo "🌐 Creating bridge network 'sehaat_saathi_network'..."
docker network create sehaat_saathi_network || true

# 2. Cleanup older containers to prevent namespace collisions
echo "🧹 Cleaning up older container instances..."
docker stop sehaat_saathi_db sehaat_saathi_backend sehaat_saathi_frontend || true
docker rm sehaat_saathi_db sehaat_saathi_backend sehaat_saathi_frontend || true

# 3. Spin up MongoDB
echo "🗄️ Starting MongoDB container..."
docker run -d \
  --name sehaat_saathi_db \
  --network sehaat_saathi_network \
  -p 27017:27017 \
  mongo:6.0

# 4. Build and run backend service
echo "📦 Building backend Docker image..."
docker build -t sehaat-saathi-backend ./backend

echo "🚀 Starting backend container..."
docker run -d \
  --name sehaat_saathi_backend \
  --network sehaat_saathi_network \
  -p 5000:5000 \
  -e PORT=5000 \
  -e MONGO_URI=mongodb://sehaat_saathi_db:27017/video-consultation \
  -e CORS_ORIGIN=http://localhost:5173 \
  sehaat-saathi-backend

# 5. Build and run frontend service
echo "📦 Building frontend Docker image..."
docker build -t sehaat-saathi-frontend ./frontend

echo "🚀 Starting frontend container..."
docker run -d \
  --name sehaat_saathi_frontend \
  -p 5173:5173 \
  -e VITE_BACKEND_URL=http://localhost:5000 \
  sehaat-saathi-frontend

echo "🎉 Services are up and running!"
echo "🖥️  Frontend: http://localhost:5173"
echo "⚙️   Backend:  http://localhost:5000"
echo "🗄️  MongoDB:  mongodb://localhost:27017"
echo ""
echo "To view logs, use: 'docker logs -f sehaat_saathi_backend' or 'docker logs -f sehaat_saathi_frontend'"
