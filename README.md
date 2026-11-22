# Greenfield College — Student Management System

React + Vite frontend and Express + MySQL backend.

## Project layout

```text
student-management-system/
├── src/                         # React application and page modules
├── public/                      # Static public assets
├── backend/
│   ├── src/
│   │   ├── config/               # Database configuration
│   │   ├── controllers/          # API/business logic
│   │   ├── middleware/           # Authentication, RBAC and rate limits
│   │   ├── routes/               # API route definitions
│   │   └── utils/                # Shared utilities and audit logging
│   ├── database/
│   │   ├── migrations/           # SQL schema changes
│   │   ├── seeds/                # Seed data
│   │   └── backups/              # Local SQL backup
│   ├── .env.example              # Safe environment template
│   ├── package.json
│   └── server.js
├── docs/                         # Project notes and change history
├── package.json                 # Frontend scripts/dependencies
└── vite.config.js
```

## Local setup

### 1. Backend environment

In PowerShell, from the project root:

```powershell
Copy-Item .\backend\.env.example .\backend\.env
```

Edit `backend/.env` and enter your own MySQL settings and a strong random `JWT_SECRET`.
Do not share or commit `.env`.

### 2. Install dependencies

Frontend (project root):

```powershell
npm install
```

Backend:

```powershell
cd .\backend
npm install
```

### 3. Start the application

Terminal 1 — backend:

```powershell
cd .\backend
node server.js
```

Terminal 2 — frontend, from the project root:

```powershell
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:5000`

## Database

- Create/select the MySQL database named by `DB_NAME`.
- Use the existing database and migration history for an existing installation.
- SQL migrations are in `backend/database/migrations/`.
- A database backup is in `backend/database/backups/greenfield_college_backup.sql`.

**Important:** Do not import the backup over your current database unless you intentionally want to restore that snapshot. It may overwrite or duplicate data depending on how it is imported. Back up the live database first.

## Security and project hygiene

- `.env`, `node_modules`, `dist`, and `.git` are intentionally not included in this cleaned source package.
- After downloading, create your own `backend/.env` from `.env.example`.
- Install dependencies with `npm install` in both the root and `backend` folders.
- Historical patch scripts and old code backups were separated from the active project; they are not required to run the current source.

## Notes

See `docs/DEVELOPMENT_NOTES.md` for the latest recorded development scope and `docs/CHANGELOG.txt` for historical notes.
