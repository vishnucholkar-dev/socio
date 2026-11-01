# Rockcliff 'B' Block — Complete Hosting & Deployment Guide

Welcome! This package contains the complete, production-ready **Rockcliff 'B' Block Apartment Management & Accounting Application**, including the full 32-flat society financial dataset, 31+ months of ledger history, water meter baselines, staff directory, and pre-compiled frontend artifacts.

---

## 📦 What Is Inside This Package

1. **Pre-Built Frontend (`dist/`)**:
   - `dist/bundle.esm.js` & `index.html`: Fully compiled, optimized React 18 + TypeScript + Tailwind bundle ready to serve instantly. No build or compilation step required.
2. **Complete Live Dataset**:
   - `src/data/apartment_seed.json`: 32 flats across 4 floors with complete billing, water, and dues history through November 2026.
   - `exports/csv/`: 10 relational CSV files for flats, billing cycles, water readings, society inflows, expenses, and vendor directory.
   - `exports/private/`: Raw verified live JSON snapshot.
3. **Backend Stack (`backend/` & `docker-compose.yml`)**:
   - Python FastAPI asynchronous REST API + PostgreSQL 18 schema + Nginx proxy configurations.
4. **Lightweight Standalone Server (`server.mjs`)**:
   - Zero-dependency Node.js HTTP server.
5. **One-Click Launchers**:
   - `start-windows.bat`: For Windows PC / laptop.
   - `start-linux.sh`: For Linux, VPS, or macOS.

---

## 🚀 Choose Your Hosting Method

### Option 1: Instant Local Hosting (Easiest — 30 Seconds)

You can run this on any PC, laptop, or home mini-server.

#### On Windows:
1. Make sure [Node.js](https://nodejs.org/) (version 20 or newer) is installed.
2. Double-click **`start-windows.bat`**.
3. It will automatically launch the server and open your browser at **`http://127.0.0.1:5174`**.

#### On Linux or macOS:
1. Open a terminal inside the unzipped folder:
   ```bash
   chmod +x start-linux.sh
   ./start-linux.sh
   ```
2. Open **`http://localhost:5174`** in your browser.

*Note: The application stores active state in the browser's `localStorage` (`rockcliff_apartment_data_v10`). Any payments recorded, water meters updated, or cycles opened are saved persistently in that browser.*

---

### Option 2: Cloud Static Web Hosting (Vercel / Netlify / Render / Cloudflare Pages)

If you want the committee members, watchman, and residents to access the app from their phones and laptops anywhere via HTTPS:

1. **Upload / Deploy**:
   - You can deploy the folder directly to **Vercel**, **Netlify**, or **Cloudflare Pages**.
   - **Build Command**: Leave empty or set to `node scripts/build.mjs`
   - **Publish / Output Directory**: `dist` (or root `.` as static files)
2. **Access & Security**:
   - Once deployed, residents can select their flat number to view bills and receipts.
   - Admin access can switch roles using the top-left role selector (👑 Admin, 🏠 Resident, 👮 Watchman).

---

### Option 3: Containerized Production (Docker Compose + PostgreSQL)

For an enterprise-grade dedicated server (e.g., Ubuntu VPS, DigitalOcean droplet, AWS EC2, or Synology NAS):

1. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and set a secure password:
   ```env
   POSTGRES_DB=rockcliff
   POSTGRES_USER=rockcliff
   POSTGRES_PASSWORD=YourStrongSecretPassword123!
   WEB_PORT=8080
   VITE_API_PROXY_TARGET=http://127.0.0.1:8000
   ```

2. **Launch Services**:
   ```bash
   docker compose up --build -d
   ```
   This starts:
   - **PostgreSQL 18** database container on an isolated Docker network.
   - **FastAPI** backend with automated schema initialization.
   - **Nginx** serving the frontend web app on port **8080**.

3. **Verify Health**:
   ```bash
   docker compose ps
   ```
   Visit `http://<your-server-ip>:8080`.

---

## 🔄 How to Maintain GitHub Code vs. Live Society Data

Your dad has configured the GitHub repository so that **no private resident data, phone numbers, or balances are leaked to GitHub**. Here is how to keep code and data in sync in the future:

### Architecture:
- **GitHub Repository**: Pure open application code + sanitized demo template (`apartment_seed.template.json`).
- **Live Server / This Package**: Holds the real `src/data/apartment_seed.json` and active browser `localStorage`.
- **Git Ignored**: `.gitignore` is pre-configured to strictly ignore `apartment_seed.json`, `apartment_data.js`, `exports/`, `.env`, and `*.zip`.

### Pulling Future Code Updates from GitHub:
When new features or bug fixes are pushed to GitHub, update the hosted app without touching the live data:

```bash
# 1. Pull the latest code updates
git pull origin main

# 2. Re-bundle frontend (if hosting statically)
node scripts/build.mjs

# 3. Restart the server / container
# For Node: restart server.mjs
# For Docker: docker compose up --build -d
```
*Because `apartment_seed.json`, `localStorage`, and the PostgreSQL Docker volume (`rockcliff-apartment-postgres-data`) are never in Git, your live data remains 100% safe and intact across all updates.*

---

## 💾 Backups & Exporting Data

- **Browser Data Backup**: In the app, navigating to **Monthly Statement** allows 1-click printing/PDF export.
- **Relational Data Backup**: Pre-exported CSVs for all 31 months are included in `exports/csv/` and can be inspected in Excel.
- **Docker Database Backup**:
  ```bash
  docker compose exec -T db pg_dump -U rockcliff rockcliff > backup_$(date +%F).sql
  ```

---

## 📞 Support & Contacts
If you encounter any issues during hosting, review `README.md` or inspect server logs with `docker compose logs -f api`.
