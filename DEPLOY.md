# Deploying Neoserve Projects Website to Render

This repository contains the complete Neoserve Projects enterprise website and API gateway, fully integrated with **Aiven Cloud MySQL (`neoserve_db`)** and sharing the exact same data, models, and brochure portfolio as the Android Mobile Application.

---

## 1. Environment Variables for Render

When setting up your Web Service on Render (or Railway / VPS), configure these environment variables under **Environment**:

| Variable | Recommended / Live Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production Node runtime flag |
| `PORT` | `3000` | Port for the Node HTTP server |
| `ADMIN_KEY` | `NeoserveAdmin2026SecureKey` | Secret key for `/admin.html` access |
| `MYSQL_HOST` | `rms-db-umangprasad3970-a391.g.aivencloud.com` | Aiven Cloud MySQL Host |
| `MYSQL_PORT` | `10469` | Aiven MySQL Port |
| `MYSQL_USER` | `avnadmin` | Aiven MySQL Username |
| `MYSQL_PASSWORD` | `<AIVEN_MYSQL_PASSWORD>` | Aiven MySQL Password |
| `MYSQL_DATABASE` | `neoserve_db` | Aiven MySQL Target Database |
| `MYSQL_SSL_MODE` | `REQUIRED` | Mandatory SSL |
| `REMOTE_API_BASE_URL`| `https://rms-monster-api.onrender.com` | Python REST API backend |

---

## 2. Quick Render Deployment Steps

1. Push this folder to your GitHub repository (e.g. `https://github.com/Umangprasad3970/neoserve-website`).
2. Log into [Render Dashboard](https://dashboard.render.com).
3. Click **New +** &rarr; **Web Service**.
4. Select your `neoserve-website` repository:
   - **Environment:** `Node`
   - **Branch:** `main`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, paste the variables from the table above.
6. Click **Create Web Service**.
7. Once deployed, attach your custom domain `rms.monster` in Render's Custom Domains tab.

---

## 3. Shared Database Architecture

Both the **Website** and the **Android Mobile App** read and write to the same live Aiven Cloud MySQL database (`neoserve_db`):
- `leads`: All contact inquiries with automated lead scoring and UUID idempotency keys.
- `contacts`: Verified point-of-contact address book.
- `consultations`: Technical site audits and grid radiation feasibility bookings (`AUD-...`).
- `quotes`: Commercial Turnkey EPC quotation proposals (`RFQ-...`).
- `services`: The 5 core clean energy disciplines from the brochure.
- `projects`: The 6 hallmark brochure projects across Gujarat, Rajasthan, and Tamil Nadu.
- `tasks`: Automated 24-hr SLA follow-up tasks for every new lead.
