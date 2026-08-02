<<<<<<< HEAD
# Neoserve Projects — Website

A full multi-page marketing website for Neoserve Projects (Wind, Solar, PEB &
EV Charging EPC), with a working contact/lead-collection form backed by a
real SQLite database, and an admin page to view submissions.

**Zero external dependencies.** It runs on plain Node.js — no `npm install`,
no build step, no framework. That makes it easy to deploy almost anywhere.

---

## 1. What's inside

```
neoserve-website/
├── server.js              # the whole backend (static files + API), plain Node http
├── lib/db.js               # SQLite storage (falls back to JSON file on old Node)
├── package.json
├── .env.example             # copy to .env and fill in ADMIN_KEY
├── data/                    # created automatically — holds neoserve.db (git-ignored)
└── public/                  # everything served to the browser
    ├── index.html            # Home
    ├── about.html
    ├── services.html         # services overview
    ├── services-wind.html
    ├── services-solar.html
    ├── services-peb.html
    ├── services-ev.html
    ├── partners.html
    ├── contact.html          # the lead-collection form
    ├── thank-you.html
    ├── admin.html             # view submitted leads (needs ADMIN_KEY)
    ├── 404.html
    ├── css/style.css
    ├── js/ (main.js, contact.js, admin.js)
    ├── partials/ (header.html, footer.html — shared nav/footer)
    └── images/ (photos pulled from your brochure)
```

## 2. Run it locally

Requires **Node.js 18 or newer** (Node **22.5+** gets you a real SQLite
database for free via the built-in `node:sqlite` module; on older Node it
automatically falls back to storing leads in `data/leads.json` instead —
everything else works exactly the same either way).

```bash
cd neoserve-website
cp .env.example .env        # then edit .env and set a real ADMIN_KEY
ADMIN_KEY=your-key node server.js
```

Visit `http://localhost:3000`. Submit the contact form, then go to
`http://localhost:3000/admin.html` and enter your admin key to see it land
in the database.

## 3. Putting it on `rms.monster`

You already own the domain — you just need somewhere for Node to run and
DNS pointed at it. Two straightforward paths:

### Option A — a VPS (DigitalOcean, Hetzner, AWS Lightsail, etc.)

1. Provision a small Linux VPS and install Node 22+ (`nvm install 22` is the
   easiest way).
2. Upload this folder to the server (`scp -r neoserve-website user@your-ip:~`).
3. Install a process manager so the site survives reboots/crashes:
   ```bash
   npm install -g pm2
   cd neoserve-website
   ADMIN_KEY=your-key pm2 start server.js --name neoserve
   pm2 save && pm2 startup
   ```
4. Put Nginx in front of it as a reverse proxy (handles HTTPS and port 80/443):
   ```nginx
   server {
     listen 80;
     server_name rms.monster www.rms.monster;
     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     }
   }
   ```
   Then run `certbot --nginx -d rms.monster -d www.rms.monster` for a free
   HTTPS certificate.
5. In your domain registrar's DNS settings for `rms.monster`, add an **A
   record** pointing `@` (and `www`) at your VPS's IP address.

### Option B — a managed Node host (Render, Railway, Fly.io)

1. Push this folder to a GitHub repo.
2. Create a new **Web Service** on Render/Railway, point it at the repo.
   Build command: none needed. Start command: `node server.js`.
3. Set the `ADMIN_KEY` environment variable in the host's dashboard.
4. Once deployed, the host gives you a URL and a CNAME target — add a
   **CNAME record** for `rms.monster` (or `www`) in your DNS pointing at
   that target, following the host's custom-domain instructions.

Either way, DNS changes can take anywhere from a few minutes to a few hours
to propagate.

## 4. The admin/leads page

`rms.monster/admin.html` is where you'll read submissions day to day — enter
the `ADMIN_KEY` you set on the server, and it lists every lead (name,
contact info, project type, location, message, timestamp), newest first.

The key is never stored in the page — you re-enter it each visit. Treat it
like a password; anyone with it can read your leads.

If you'd rather get an email the moment someone submits the form instead of
checking the admin page, the natural next step is wiring `lib/db.js`'s
`addLead()` up to an email service (e.g. via SMTP with `nodemailer`, or a
transactional email API) — that needs real SMTP/API credentials from you, so
it wasn't something I could wire up and test in this environment, but the
code is a small, well-isolated place to add it.

## 5. Editing content later

- **Text**: each page is plain HTML — open the relevant `.html` file in
  `public/` and edit directly.
- **Nav / footer**: edit once in `public/partials/header.html` or
  `footer.html` — every page picks up the change automatically.
- **Colors / fonts / spacing**: all design tokens live at the top of
  `public/css/style.css` under `:root`.
- **Images**: drop new files into `public/images/` and update the `src`
  attributes referencing them.

## 6. Notes

- The contact form has basic spam protection (a honeypot field plus
  per-IP rate limiting of 6 submissions per 10 minutes) — no CAPTCHA is
  wired in, but the validation logic in `server.js` (`handleContact`) is
  the place to tighten that further if spam becomes an issue.
- `data/neoserve.db` (or `data/leads.json` on older Node) is where all
  leads live — back this file up periodically once the site is live.
- Nothing here calls any third-party API or sends data off your server —
  the only external network call the *pages themselves* make is loading
  Google Fonts.
=======
# rms-monster
>>>>>>> a128bf1f00b8cf5fb89683c93d59d2b060f018a7
