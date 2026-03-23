# Changelog

All notable changes to Soccorso Digitale are documented in this file.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
Versioning: [Semantic Versioning](https://semver.org/)

---

## [2.0.0] — 2026-03-22

### Added

**Core Platform**
- Multi-tenant architecture with full data isolation per `organizationId`
- 140+ PostgreSQL tables managed via Drizzle ORM
- 655+ REST API endpoints
- React Native mobile app with 44 screens (iOS and Android)
- Web admin dashboard (vanilla JS + Tailwind CSS)

**Trip Management**
- Cryptographic trip signing (HMAC-SHA256) for tamper-evident records
- Real-time GPS tracking via WebSocket
- UTIF PDF report generation (fuel tax reimbursement)
- Automatic distance calculation via OSRM
- Offline trip queuing with background sync
- Trip integrity verification endpoint

**Financial Systems**
- Stripe integration: subscriptions and one-time billing
- Staff cost calculation with contract-based hourly billing
- Revenue reporting and financial analytics
- Credit deduction system per trip/service

**Compliance & Legal**
- GDPR compliance module: consent tracking, data export, erasure requests
- Volunteer registry compliant with Art. 17 CTS (Codice del Terzo Settore)
- Audit trail with hash chain verification (ISO 27001 ready)
- Digital signature workflow via email-based document signing
- ULSS 9 tender compliance system

**Operations**
- Monthly shift planning with burnout prevention
- Multi-profile vehicle support
- Three-tier inventory management with QR/barcode scanning
- SLA monitoring with per-contract metric configuration and auto-detection of breaches
- Infrastructure health monitoring every 5 minutes with email alerts

**Reporting & Analytics**
- PDF generation with 10+ templates
- Excel/CSV export for all major data sets
- ESG/sustainability tracking (carbon footprint per trip)
- Public Impact Dashboard

**Public-Facing Features**
- Booking Hub: public service request portal per organization
- System status page (`/status`)
- Android APK distribution system with access codes

### Security

- Role-based access control with 5+ roles (superadmin, director, dispatcher, crew, viewer)
- Session-based authentication with secure, httpOnly cookies
- Audit trail with cryptographic hash chain verification
- GDPR data export and erasure workflows
- Rate limiting on all endpoints
- Input validation via Zod schemas on all route handlers

### Infrastructure

- Railway deployment with automatic PostgreSQL provisioning
- Google Cloud Storage for file uploads (signatures, APKs, logos)
- Resend transactional email
- Structured JSON logging
- Gzip compression for all responses
- Helmet.js security headers
- Pre-commit hooks via Husky + lint-staged

---

## [1.0.0] — 2026-03-21

### Added

- Initial release of Soccorso Digitale
- Basic trip logging for ambulance crews
- Express.js backend with PostgreSQL
- React Native mobile app skeleton
- User authentication with session management
- Initial database schema with Drizzle ORM
- Railway deployment configuration
