# Rockcliff 'B' Block — Apartment Management & Accounting System

A comprehensive, transparent apartment association management platform designed for gated communities and multi-flat housing societies. Built with React 18, TypeScript, Tailwind CSS, FastAPI, and PostgreSQL.

---

## 🌟 Key Features

1. **Meter-Based Water Utility Billing**:
   - Monthly fair water consumption charge calculation using real meter readings (Closing − Opening).
   - Dynamic formula: `Rate (₹/L) = (Tanker Outflow + Net Pumping Electricity) / Total Society Liters`.
   - Separate tracking for common amenities deduction, mandatory maintenance fee, and prior arrears.
   - Walkthrough entry mode matching building plumbing shafts and floor vertical risers.

2. **Accounting & Segregated Balances**:
   - Strict segregation between **Cash in Hand (Petty Cash)** and **Society Bank Savings Account**.
   - Atomic balance transfers between Cash and Bank with failure-safe balance validation.
   - Separate tracking of association inflows (vendor rent, bank interest, scrap sales) and outflows.
   - Complete 32-flat monthly financial association statements with official 3-signature committee sign-off blocks.

3. **Monthly Cycle Lifecycle & Safeguards**:
   - Sequential cycle opening preventing out-of-order months.
   - Pre-close checklist enforcing 100% complete, non-decreasing meter readings and reconciled ledgers.
   - Audited admin-only reopen capability strictly limited to the latest closed cycle.
   - Safe legacy migration separating verified reconciled cycles from locked historical data.

4. **Multi-Role Access**:
   - **👑 Admin**: Full access to financial ledgers, cycle management, water billing rates, and staff directory.
   - **🏠 Resident**: Read-only access to my flat dues, itemized receipts, water consumption trends, and directory.
   - **👮 Watchman**: Minimal walkthrough view restricted to meter readings input and gate cash handover.

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js (v20+ or v24+)
- pnpm (v9+ or v11+) or npm

### Installation
```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/apartment-app.git
cd apartment-app

# 2. Install dependencies
pnpm install

# 3. Setup template data
pnpm run setup:seed

# 4. Run tests
pnpm test

# 5. Start development server
node server.mjs
# Open http://127.0.0.1:5174 in your browser
```

---

## 🔒 Data Isolation & Privacy Policy

This repository contains **application source code only**. 

- **Git-Ignored Datasets**: All live resident names, phone numbers, flat collection histories, and verified building snapshots are strictly excluded from version control via `.gitignore`.
- **Demo Template**: When cloned, the repository initializes with an anonymized demo dataset (`src/data/apartment_seed.template.json`) containing sample mock flats for demonstration and testing.
- **Live Data Deployment**: Operational deployments inject live data using isolated environment volumes or private snapshot files (`exports/private/`) without checking them into Git.

---

## 🧪 Testing

The repository includes a comprehensive 17-point test suite covering cycle migration, reopen safeguards, atomic transfers, pre-close checklists, and sequential carry-forward:

```bash
pnpm test
```

---

## 🐳 Containerized Production Stack (Docker)

To run the complete production stack (PostgreSQL + FastAPI + Nginx):

```bash
# 1. Copy sample environment variables
cp .env.example .env

# 2. Set your POSTGRES_PASSWORD in .env

# 3. Build and launch services
docker compose up --build -d
```
The application will be available at `http://localhost:8080`.
