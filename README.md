# GEO.LINK: URL Shortener with Geolocation Analytics

A high-performance GIS service utilizing Spring Boot, React, and PostGIS to map unique identifier strings to destination URLs with rich telemetry.

## Tech Stack
- **Backend**: Java 17, Spring Boot 3, Hibernate Spatial, PostGIS
- **Frontend**: React (Vite), Leaflet.js, Framer Motion
- **Infrastructure**: Docker, GitHub Actions

## Getting Started

### 1. Database
Ensure Docker is running and start the PostGIS instance:
```bash
docker compose up -d
```

### 2. Backend
Navigate to the `backend` directory and run with Maven:
```bash
cd backend
mvn spring-boot:run
```

### 3. Frontend
Navigate to the `frontend` directory, install dependencies, and start the dev server:
```bash
cd frontend
npm install
npm run dev
```

## Project Structure
- `/backend`: Spring Boot application logic and PostGIS integration.
- `/frontend`: React dashboard and Leaflet map implementation.
- `/.github/workflows`: CI/CD pipeline configuration.
- `docker-compose.yml`: Local environment setup.
