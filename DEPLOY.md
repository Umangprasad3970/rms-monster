# Deploying `rms-monster` to a Node host (Render example)

This repository contains a Node web server (`server.js`) and static files in `public/`.

I prepared two files to help deploy:
- `Dockerfile` — container image that runs `node server.js` on port 3000.
- `render.yaml` — Render service descriptor to import the app easily.

Quick Render deployment steps:

1. Create a Render account and connect your GitHub repository.
2. In Render, choose "New" → "Web Service" and import this repository (or use `render.yaml`).
   - If importing manually, set:
     - Environment: `Node`
     - Branch: `main`
     - Build command: `npm install`
     - Start command: `npm start`
3. Set the environment variable `ADMIN_KEY` in Render (optional, necessary for `/api/leads`).
4. After the service is live, add a Custom Domain `rms.monster` in the Render dashboard.
   - Render will display DNS targets to add to your domain registrar.
   - For the apex domain (`rms.monster`) you may need an A/ALIAS record; for `www` add a CNAME to the target Render provides.
5. Remove or update any existing GitHub Pages custom domain settings for this repo (in GitHub repo Settings → Pages) to avoid conflicts.

DNS notes:
- Currently the domain is served by GitHub Pages. Once you configure the Render service and add the custom domain there, Render will give you the exact DNS records to create. Replace the GitHub Pages records with the records Render requests.

If you prefer a different host (Railway, Fly, VPS, DigitalOcean App Platform), I can generate equivalent config (Dockerfile is already present and portable).
