# DIGI Digital Service

Single-user digital service center management app.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (Supabase-compatible)
- Deployment: Vercel (frontend), Render (backend)

## Local setup

### 1. Requirements
Install Node.js LTS and Git. Create a PostgreSQL database in Supabase or use local PostgreSQL.

### 2. Backend
```bash
cd backend
cp .env.example .env
```
Edit `.env` and set `DATABASE_URL`, `JWT_SECRET`, and `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
Then:
```bash
npm install
npm run dev
```
Backend defaults to http://localhost:5000. It creates tables on startup.

### 3. Frontend
In another terminal:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open the Vite URL shown in the terminal.

## Important security notes
- Change the sample credentials before use.
- Never commit `.env`.
- Use a long random `JWT_SECRET`.
- For Supabase, use the database connection string with SSL enabled; keep credentials private.
- Free hosting plans can sleep or change limits. Do not rely on this starter as the only record of business accounts until you have tested backups and restores.
- This is a practical starter, not audited accounting/tax software.

## GitHub
Create an empty repository on GitHub, then from the project root:
```bash
git init
git add .
git commit -m "Initial DIGI Digital Service app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/digi-digital-service.git
git push -u origin main
```

## Deployment overview
- Render: create a Web Service from the GitHub repository, root directory `backend`, build command `npm install`, start command `npm start`. Add `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `FRONTEND_ORIGIN` environment variables.
- Vercel: import the same repository, set root directory `frontend`, framework Vite, and set `VITE_API_URL` to your Render backend URL plus `/api` (e.g. `https://your-service.onrender.com/api`).
- Add your deployed Vercel URL to Render's `FRONTEND_ORIGIN`.
