# Soccorso Digitale — Transport Management Platform

## Overview

**Soccorso Digitale** is a mobile-first, multi-tenant SaaS platform for Italian ambulance and medical transport services. It streamlines operations, enhances data accuracy, and ensures regulatory compliance.

The platform includes:
- **React Native mobile app** (iOS/Android) for ambulance crews
- **Web admin dashboard** for dispatchers and directors
- **Backend API** with PDF report generation, GPS tracking, and financial systems

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile/Web Frontend | React Native 0.81.5 + Expo SDK 54 |
| Navigation | React Navigation v7 |
| State Management | TanStack React Query + React Context |
| Styling | React Native StyleSheet + Tailwind CSS |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Migrations | Drizzle Kit |
| Email | Resend API |
| Storage | Google Cloud Storage |
| Payments | Stripe |
| PDF Generation | pdfkit (server-side) |
| Distance Calc | OSRM (Open Source Routing Machine) |

---

## System Architecture

### Frontend
- **Framework**: React Native with Expo SDK 54 (iOS, Android, Web)
- **Navigation**: React Navigation v7
- **State**: TanStack React Query for server state, React Context for auth, AsyncStorage for local state
- **Colors**: Primary Blue `#0066CC`, Primary Green `#00A651`

### Backend
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Schema**: Shared Drizzle schema for type safety across frontend and backend
- **API**: RESTful JSON endpoints
- **Authentication**: Express sessions with cookie-based auth

### Key Design Decisions

- **Multi-Tenant Architecture**: Multiple organizations with full data isolation and RBAC (5+ roles)
- **Vehicle-Based Authentication**: Unique login per ambulance
- **Mobile Offline Mode**: Local trip queuing with background sync
- **Automated Calculations**: OSRM distance, automatic trip numbering, mileage updates
- **PDF Report Generation**: Server-side UTIF forms for fuel tax reimbursement
- **Financial Systems**: Staff cost calculation and contract-based hourly billing
- **Audit Trail**: Cryptographic audit logging (ISO 27001 ready)
- **GDPR Compliance**: Consent tracking, data export, and erasure requests
- **Three-Tier Inventory**: Template-based checklists with QR/barcode scanning
- **Trip Integrity Signing**: HMAC-SHA256 cryptographic signing of trip records
- **SLA Monitoring**: Per-contract SLA metric configuration with violation auto-detection
- **Infrastructure Health**: Proactive health checks every 5 minutes with email alerts
- **Digital Signature Workflow**: Email-based document signing system
- **Shift Planning**: Monthly scheduling with burnout prevention and multi-profile vehicles
- **Volunteer Registry**: Art. 17 CTS compliant electronic registry

---

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- npm

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Secure random string for session encryption
- `RESEND_API_KEY` — Resend email API key
- `GOOGLE_MAPS_API_KEY` — Google Maps API key
- `STRIPE_SECRET_KEY` — Stripe secret key
- `TRIP_INTEGRITY_SECRET` — Secret for HMAC trip signing

### Install & Run

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Development (frontend + backend in parallel)
npm run all:dev

# Or separately:
npm run expo:dev      # Expo / React Native (port 8081)
npm run server:dev    # Express API (port 5000)
```

### Production Build

```bash
# Build server
npm run server:build

# Build Expo static web
npm run expo:static:build

# Start production server
npm run server:prod
```

---

## Project Structure

```
├── client/          # React Native app (44 screens, 25 components)
├── server/          # Express.js API, PDF generation, business logic
├── shared/          # Drizzle ORM schema (shared between client & server)
├── admin/           # Web admin panel
├── migrations/      # Database migrations
├── scripts/         # Build and data import utilities
├── public/          # Static web assets
├── uploads/         # User uploads (logos, APKs) — folders preserved with .gitkeep
├── docs/            # Legal documentation
└── assets/          # App static assets (images, icons)
```

---

## Key Features

- Trip management with GPS tracking and real-time sync
- UTIF PDF reports for fuel tax reimbursement
- Multi-company shift planning and scheduling
- Staff cost calculation and financial reporting
- Electronic volunteer registry (Art. 17 CTS)
- QR/barcode inventory management
- Carbon footprint tracking per trip
- Public Impact Dashboard and ESG reporting
- Booking Hub for public service requests
- ULSS 9 / tender compliance system
- Android APK distribution system
- Public system status page (`/status`)
