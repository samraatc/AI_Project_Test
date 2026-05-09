# EstimateOS — AI-Powered Enterprise Estimation Platform

## Overview
Full-stack SaaS platform for AI-powered project estimation, quotation generation, and cost analysis targeting construction, fabrication, oil & gas, manufacturing, EPC, and industrial engineering sectors.

## Tech Stack
- **Backend**: NestJS 10, TypeScript, PostgreSQL 16, Redis, Bull queues
- **AI**: OpenAI GPT-4o, text-embedding-3-large, Qdrant vector DB
- **Frontend**: Next.js 14, React 18, TailwindCSS, TanStack Query, Recharts
- **Storage**: MinIO (S3-compatible), Handlebars+Puppeteer for PDF
- **Infrastructure**: Docker Compose, Kubernetes manifests, GitHub Actions CI/CD

## Quick Start

### Prerequisites
- Docker Desktop (https://docker.com/products/docker-desktop)
- Node.js 20+ (https://nodejs.org)

### Step 1 — Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env → set OPENAI_API_KEY=sk-your-key-here
```

### Step 2 — Start infrastructure services
```bash
docker compose up -d
# Starts: PostgreSQL, Redis, Qdrant, MinIO
```

### Step 3 — Run database migrations
Migrations run automatically when PostgreSQL starts (files are in database/migrations/).
Manual run if needed:
```bash
docker compose exec postgres psql -U estimateos -d estimateos \
  -f /docker-entrypoint-initdb.d/001_tenants_and_users.sql
# Repeat for 002, 003, 004
```

### Step 4 — Start backend
```bash
cd backend
npm install
npm run build
npm start
# OR for development: npm run start:dev
```

### Step 5 — Start frontend
```bash
cd frontend
npm install
npm run dev
```

## Access
| Service | URL | Credentials |
|---------|-----|-------------|
| App | http://localhost:3001 | admin@estimateos.com / Admin@123! |
| API Swagger | http://localhost:3000/api/docs | Bearer token |
| MinIO Console | http://localhost:9001 | minioadmin / changeme |
| Qdrant Dashboard | http://localhost:6333/dashboard | — |

## AI Workflow
1. Create a project → upload PDF/Excel/Word documents
2. Click **Run AI Analysis** → GPT-4o reads documents, embeds them in Qdrant
3. AI generates full itemised estimation with confidence scores, risk analysis, recommendations
4. Review and edit line items in the estimation editor
5. Click **Generate Quote** → AI drafts professional quotation → download as PDF or send by email

## Environment Variables
See `backend/.env.example` for full documentation.

**Only required change**: `OPENAI_API_KEY=sk-your-key`

**Docker service names** (do NOT change to localhost when using Docker Compose):
- `DB_HOST=postgres`
- `REDIS_HOST=redis`
- `QDRANT_HOST=qdrant`
- `MINIO_ENDPOINT=minio`

## Architecture
```
frontend (Next.js :3001)
    ↓ REST API
backend (NestJS :3000)
    ↓ TypeORM         ↓ Bull/Redis      ↓ OpenAI API
  PostgreSQL         Redis queues       GPT-4o / embeddings
    ↓                                      ↓
  Projects, Users,                      Qdrant (vectors)
  Estimations, Quotations               MinIO (files)
```

## Default Login
**Email**: admin@estimateos.com
**Password**: Admin@123!
