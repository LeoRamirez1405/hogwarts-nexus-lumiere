<p align="center">
  <img src="frontend/public/logo.svg" alt="Hogwarts Nexus Lumiere Logo" width="180" height="180" />
</p>

<h1 align="center">Hogwarts Nexus Lumiere</h1>

<p align="center">
  <strong>A magical social & economic platform — where wizards connect, trade, and thrive.</strong>
</p>

<p align="center">
  <a href="#-features"><strong>Features</strong></a> •
  <a href="#-architecture"><strong>Architecture</strong></a> •
  <a href="#-tech-stack"><strong>Tech Stack</strong></a> •
  <a href="#-getting-started"><strong>Getting Started</strong></a> •
  <a href="#-auto-update-flow"><strong>Auto-Update</strong></a> •
  <a href="#-deployment"><strong>Deployment</strong></a> •
  <a href="#-contributing"><strong>Contributing</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/TailwindCSS-4-38B2AC?logo=tailwind-css&logoColor=white" alt="TailwindCSS 4" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/SQLAlchemy-2.0-red?logo=sqlalchemy&logoColor=white" alt="SQLAlchemy" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" alt="Capacitor" />
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/E2E_Encryption-X3DH-purple?logo=lock&logoColor=white" alt="E2E Encryption" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## ✨ Features

### 🏰 Magical Zones (Views)

| Zone | Description | Theme |
|------|-------------|-------|
| **📊 Dashboard** | Personal overview: Zerines balance, pet status, upcoming events, quick actions | Light |
| **💬 Messages** | Real-time chat with E2E encryption, voice/video calls, reactions, polls, scheduled messages | Light |
| **📰 El Quisquilloso** | News & articles — wizarding world journalism with subscriptions & comments | Light (parchment) |
| **🏪 Borgin & Burkes** | Dark marketplace for rare/dark artifacts — auctions, classifieds, wishlists | **Dark** (gold accents) |
| **💎 Treasure Chamber** | Zerines (💎) economy: vault, transactions, rewards, roulette, packs | Light (crystal/glass) |
| **🐾 Pet Sanctuary** | Adopt, feed, play, and care for magical creatures — progress tracking, items | Light (nature) |
| **📚 Flourish & Blotts** | Book & supply marketplace — catalogs, collections, admin management | Light |
| **👤 Social Profile** | Wizard profile: posts, badges, friends, pet showcase, bio | Light |
| **⚙️ Admin Panel** | Full CRUD for all entities: users, products, creatures, transactions, settings | Light |

### 🔐 Core Capabilities

- **End-to-End Encryption** — X3DH + Double Ratchet for messages (Signal protocol)
- **Real-time WebSocket** — Messages, voice channels, typing indicators, presence
- **Voice & Video** — WebRTC-powered calls with recording support
- **Push Notifications** — Firebase (FCM) + Web Push (VAPID) for PWA
- **Auto-Update (WhatsApp-style)** — CI builds signed APK → webhook → toast notification → one-tap install
- **PWA + Capacitor** — Installable on Android, iOS (Add to Home), Desktop
- **Role-based Access** — User / Admin with granular permissions
- **Zerines Economy** — 💎 currency with vault, transactions, roulette, packs
- **Pet System** — Creatures with hunger/happiness/energy, care loops, items
- **Albums & Collections** — Digital collectibles with gallery view

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HOGWARTS NEXUS LUMIERE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Frontend   │     │   Backend    │     │  Mobile      │                │
│  │  (Next.js)   │◄───►│  (FastAPI)   │◄───►│  (Capacitor) │                │
│  └──────────────┘     └──────────────┘     └──────────────┘                │
│         │                     │                     │                       │
│         ▼                     ▼                     ▼                       │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         Shared Infrastructure                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │   │
│  │  │PostgreSQL│  │  Redis   │  │Cloudinary│  │ Firebase │             │   │
│  │  │ (Neon)   │  │ (Upstash)│  │  (Media) │  │  (FCM)   │             │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Auto-Update Flow (WhatsApp-Style)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CI as GitHub Actions
    participant GH as GitHub Releases
    participant Backend as Backend API
    participant App as User App (Android/Web/iOS)

    Dev->>CI: Push to main
    CI->>CI: Build frontend + Sign APK
    CI->>CI: Bump version (patch/minor/major)
    CI->>GH: Create Release + Upload APK
    CI->>Backend: POST /api/app/version (webhook)
    Backend->>Backend: Update version_info.json
    App->>Backend: Poll GET /api/app/version (1h)
    Backend-->>App: { latest: "1.0.1", available_update: true }
    App->>User: Toast: "Update 1.0.1 available"
    User->>App: Tap toast
    alt Android (Capacitor)
        App->>Backend: GET /api/app/apk → Download APK
        App->>OS: Intent: Install package
    else Web / iOS PWA
        App->>SW: Reload → Service Worker updates
    end
    App->>User: Restart on v1.0.1
```

---

## 🛠 Tech Stack

### Frontend
| Category | Technology |
|----------|------------|
| Framework | **Next.js 16** (App Router, React 19, Turbopack) |
| Styling | **TailwindCSS 4** + CSS Variables (Design System) |
| Language | **TypeScript 5** (strict mode) |
| State | **Zustand** (global) + **TanStack Query v5** (server state) |
| UI Primitives | **Radix UI** (accessible, unstyled components) |
| Animation | **Motion (Framer Motion 12)** |
| Real-time | **Native WebSocket** + custom hook |
| Crypto | **Web Crypto API** (SubtleCrypto) for E2E |
| PWA | **Service Worker** (Workbox) + **next-pwa** |
| Mobile | **Capacitor 8** (Android, iOS) |

### Backend
| Category | Technology |
|----------|------------|
| Framework | **FastAPI 0.115** (async, OpenAPI) |
| ORM | **SQLAlchemy 2.0** (async, 2.0 style) |
| Database | **PostgreSQL** (Neon serverless) / **SQLite** (dev) |
| Migrations | **Alembic** (autogenerate, never `create_all`) |
| Auth | **JWT** (RS256, JWKS) + **bcrypt** |
| Rate Limit | **slowapi** (Redis-backed) |
| Compression | **Brotli** + GZip fallback |
| Real-time | **WebSocket Manager** (Redis pub/sub for multi-worker) |
| Push | **Firebase Admin** (FCM) + **pywebpush** (VAPID) |
| Media | **Cloudinary** (images) + local fallback |
| Background Tasks | **asyncio loops** (retention, pet care, events, etc.) |

### DevOps & CI/CD
| Tool | Purpose |
|------|---------|
| **GitHub Actions** | CI (lint, typecheck, test) + CD (build APK, sign, release) |
| **Docker** | Backend container (multi-stage, non-root) |
| **Render** | Backend hosting (Free tier + cron job for keep-alive) |
| **Vercel** | Frontend hosting (Edge, preview deployments) |
| **Neon** | Serverless PostgreSQL (auto-suspend) |
| **Upstash** | Serverless Redis (rate limit, pub/sub, cache) |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 20 (frontend)
- **Python** ≥ 3.12 (backend)
- **Docker** (optional, for containerized dev)
- **Android Studio** + **JDK 17** (for APK builds)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/hogwarts-nexus-lumiere.git
cd hogwarts-nexus-lumiere
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy env template
cp .env.example .env
# Edit .env with your values (see Configuration below)

# Run migrations
alembic upgrade head

# Seed database (optional)
python -m app.seed

# Start dev server
uvicorn app.main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local with your values

# Generate SSL certs for HTTPS dev (required for Web Push, WebRTC)
npm run dev:certs  # or run the script in scripts/

# Start dev server (HTTPS)
npm run dev
# Or HTTP only: npm run dev:http
```

### 4. Mobile (Capacitor)

```bash
cd frontend

# Build web assets
npm run build

# Sync to native projects
npx cap sync

# Open in Android Studio / Xcode
npx cap open android
npx cap open ios
```

---

## ⚙️ Configuration

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=sqlite+aiosqlite:///./nexus.db          # Dev
# DATABASE_URL=postgresql+asyncpg://user:pass@host/db # Prod (Neon)

# Auth
JWT_SECRET_KEY=your-super-secret-key-min-32-chars
JWT_ALGORITHM=RS256
JWKS_URL=https://your-domain/.well-known/jwks.json

# CORS
CORS_ORIGINS=https://your-frontend.vercel.app,http://localhost:3000

# Redis (Upstash)
REDIS_URL=rediss://user:pass@host:port

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud
CLOUDINARY_API_KEY=your-key
CLOUDINARY_API_SECRET=your-secret

# Firebase (FCM)
FIREBASE_PROJECT_ID=your-project
FIREBASE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Web Push (VAPID)
VAPID_PRIVATE_KEY=your-vapid-private
VAPID_PUBLIC_KEY=your-vapid-public
VAPID_CLAIMS_SUB=mailto:admin@yourdomain.com

# Version file (for auto-update)
VERSION_FILE_PATH=/app/version_info.json
```

### Frontend (`frontend/.env.local`)

```env
# API
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-backend.onrender.com

# App version (injected at build time by CI)
NEXT_PUBLIC_APP_VERSION=1.0.0

# Firebase (Web Push)
NEXT_PUBLIC_FIREBASE_API_KEY=your-web-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your-vapid-public

# Feature flags
NEXT_PUBLIC_ENABLE_E2E=true
NEXT_PUBLIC_ENABLE_PWA=true
```

---

## 📱 Auto-Update Flow

The platform implements **WhatsApp-style automatic updates** for Android, Web PWA, and iOS PWA.

### How It Works

1. **Push to `main`** triggers GitHub Actions workflow
2. **CI builds** frontend → signs APK with keystore → bumps version (SemVer)
3. **GitHub Release** created with signed APK artifact
4. **Webhook** POSTs new version to backend `/api/app/version`
5. **Client polls** every hour → detects `latest !== current`
6. **Toast notification** appears: *"Actualización 1.0.1 disponible. Toca para instalar."*
7. **One tap** → downloads APK (Android) or reloads SW (Web/iOS)

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore store password |
| `ANDROID_KEY_ALIAS` | Key alias |
| `ANDROID_KEY_PASSWORD` | Key password |
| `BACKEND_DEPLOY_WEBHOOK` | (Optional) `https://api.yourdomain.com/api/app/version` |

### Manual Version Bump

```bash
# Patch (default)
gh workflow run build-android-apk.yml

# Minor
gh workflow run build-android-apk.yml -f version_bump=minor

# Major
gh workflow run build-android-apk.yml -f version_bump=major
```

### Version Schema (`version_info.json`)

```json
{
  "current": "1.0.0",
  "latest": "1.0.1",
  "version_code": 10001,
  "apk_download_url": "/api/app/apk",
  "release_notes": "Bug fixes y mejoras de rendimiento",
  "force_update": false,
  "min_supported_version": "0.1.0"
}
```

- **`force_update: true`** → Persistent toast, blocks app usage until updated
- **`min_supported_version`** → Versions below are incompatible, forces update

---

## 🚢 Deployment

### Backend (Render)

1. Connect GitHub repo to Render
2. Create **Web Service** from `backend/Dockerfile`
3. Add environment variables from `.env.example`
4. Create **Cron Job** (Free tier keep-alive):
   - Schedule: `*/10 * * * *` (every 10 min)
   - Command: `curl -s https://your-api.onrender.com/health`

### Frontend (Vercel)

1. Import repo in Vercel
2. Root directory: `frontend`
3. Framework preset: Next.js
4. Add environment variables from `.env.example`
5. Deploy → automatic preview on PRs

### Database (Neon)

1. Create Neon project
2. Copy connection string → `DATABASE_URL`
3. Run migrations: `alembic upgrade head` (CI does this automatically)

### Redis (Upstash)

1. Create Upstash Redis database
2. Copy `REDIS_URL` → backend env
3. Enable **Redis Pub/Sub** for WebSocket multi-worker support

---

## 🧪 Development Commands

### Backend

```bash
cd backend

# Lint
ruff check .

# Format
ruff format .

# Type check (mypy)
mypy app/

# Tests
pytest -v

# Generate migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Check file sizes (CI)
find app -name "*.py" -exec wc -l {} + | awk '$1 > 500 {print "ERROR: " $2 " tiene " $1 " líneas"}'
```

### Frontend

```bash
cd frontend

# Lint
npm run lint

# Type check
npm run typecheck

# Build
npm run build

# Analyze bundle
npm run analyze

# Check file sizes (CI)
find app -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1 > 500 {print "ERROR: " $2 " tiene " $1 " líneas"}'
```

---

## 📁 Project Structure

```
hogwarts-nexus-lumiere/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, typecheck, test
│       └── build-android-apk.yml     # Build, sign, release, webhook
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI app + lifespan
│   │   ├── config.py                 # Pydantic settings
│   │   ├── database.py               # SQLAlchemy async engine
│   │   ├── models/                   # SQLAlchemy models (30+)
│   │   ├── schemas/                  # Pydantic schemas
│   │   ├── routers/                  # API endpoints (40+)
│   │   │   ├── admin/                # Admin-only routers
│   │   │   ├── version.py            # Auto-update version API
│   │   │   └── apk.py                # Signed APK download
│   │   ├── services/                 # Business logic (domain-driven)
│   │   │   ├── messages/             # Message, conversation, E2E
│   │   │   ├── events/               # Events, RSVPs, reminders
│   │   │   └── e2e/                  # X3DH encryption
│   │   ├── middleware/               # Auth, roles, rate limit
│   │   └── utils/                    # Helpers
│   ├── alembic/                      # Migrations
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── (main)/                   # Authenticated routes
│   │   │   ├── dashboard/            # Dashboard page
│   │   │   ├── messages/             # Chat (3-pane layout)
│   │   │   ├── pets/                 # Pet Sanctuary
│   │   │   ├── treasury/             # Treasure Chamber
│   │   │   ├── marketplace/
│   │   │   │   └── flourish-blotts/  # Book marketplace
│   │   │   ├── profile/              # Social profile
│   │   │   ├── admin/                # Admin panels
│   │   │   └── ...
│   │   ├── (auth)/                   # Public auth routes
│   │   ├── layout.tsx                # Root layout + providers
│   │   └── globals.css               # Design system CSS variables
│   ├── components/
│   │   ├── ui/                       # Shared UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── GlassCard.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── SWUpdateNotifier.tsx  # Auto-update toast
│   │   │   └── APKInstallBanner.tsx  # Android install banner
│   │   └── ...
│   ├── hooks/
│   │   ├── usePWA.ts                 # useAppVersion + useServiceWorker
│   │   ├── useMessages.ts
│   │   ├── useE2EEncryption.ts
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts                    # TanStack Query wrappers
│   │   ├── crypto.ts                 # Web Crypto helpers
│   │   └── ws.ts                     # WebSocket client
│   ├── public/                       # Static assets
│   ├── package.json
│   └── tsconfig.json
├── DESIGN.md                         # Design system specification
├── AGENTS.md                         # Development guidelines
└── README.md
```

---

## 🎨 Design System (Lumiere)

### Colors

| Role | Light | Dark (Borgin) |
|------|-------|---------------|
| Primary | `#0e3b60` (Navy) | `#a4caf6` |
| Secondary | `#775a19` (Gold) | `#fed488` |
| Surface | `#fcf9f8` | `#313030` |
| On-Surface | `#1c1b1b` | `#f3f0ef` |

### Typography

- **Display/Headlines**: EB Garamond (literary, timeless)
- **Body/UI**: Hanken Grotesk (sharp, legible)
- **Labels/Data**: JetBrains Mono (monospace, precise)

### Principles

- **Glassmorphism** — `backdrop-filter: blur(12px)` with subtle borders
- **Zonal Palette** — Each zone has distinct accent colors
- **8px Rhythm** — All spacing multiples of 8px
- **Pill Buttons** — 100px border-radius for flow
- **Material Symbols** — Outlined, 1.5px stroke, glow on hover

---

## 🔒 Security

- **E2E Encryption** — X3DH key agreement + Double Ratchet (Signal protocol)
- **JWT RS256** — Asymmetric keys, JWKS rotation
- **Rate Limiting** — Redis-backed, per-endpoint configurable
- **CORS** — Explicit origins, no wildcards in production
- **Input Validation** — Pydantic v2 on all endpoints
- **SQL Injection** — SQLAlchemy ORM (parameterized queries)
- **XSS Protection** — DOMPurify on user content, CSP headers
- **Secrets** — Never committed; injected via CI/CD secrets

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Follow the guidelines in [AGENTS.md](AGENTS.md):
   - **Regla #1**: Everything must work (no dummy buttons)
   - **Regla #7**: Backend first (migrations via Alembic)
   - **Regla #12**: Max 500 lines/file — modularize early
4. Run checks: `npm run lint && npm run typecheck` / `ruff check .`
5. Commit with conventional messages: `feat: add magical feature`
6. Push and open a Pull Request

---

## 🙏 Acknowledgments

- **Stitch** — Initial design reference for Lumiere
- **Signal Protocol** — X3DH + Double Ratchet specification
- **Material Symbols** — Icon library
- **EB Garamond / Hanken Grotesk / JetBrains Mono** — Typography
- **Next.js / FastAPI / TailwindCSS** — Amazing frameworks

---

<p align="center">
  Made with ❤️ and ✨ by the Hogwarts Nexus Team
</p>

<p align="center">
  <sub>Lumos maxima — Let there be light.</sub>
</p>