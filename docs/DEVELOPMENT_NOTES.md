# Development update — November 2026

## Added in this update

- Added database-backed Examinations management (create, list, edit, delete).
- Added database-backed Timetable management (create, list, edit, delete), with course and teacher lookups.
- Added database-backed Messages (send to all student accounts or staff accounts, list sent/received messages, per-recipient read state, delete messages sent by the current staff account).
- Connected student portal Notices to messages sent by college administration.
- Added account Settings with the existing authenticated change-password endpoint.
- Added a consistent responsive visual layer for the new admin modules.

## Database setup

The backend creates the following tables automatically when it starts:

- `examinations`
- `timetable_entries`
- `messages`

These are additive migrations. Existing student, teacher, course, attendance, fee, result and leave tables are not dropped or rewritten.

## Environment setup

1. Copy `backend/.env.example` to `backend/.env`.
2. Fill in your own MySQL credentials and strong secrets.
3. Never upload `.env` or `Credential.txt` to a public Git repository.
4. If real credentials were ever committed or shared publicly, rotate them.

## Run locally

From the project root:

```bash
npm install
npm run dev
```

In a second terminal:

```bash
cd backend
npm install
node server.js
```

Make sure the MySQL database named in `DB_NAME` already exists and the existing base tables (`users`, `students`, `courses`, `teachers`) have been created by your current setup/seed process.

## Important scope note

This is an incremental first development pass. The new modules have database-backed core workflows, but a full production release still needs end-to-end testing against your actual MySQL database, role-by-role verification, and a second pass on the older dashboard and existing management screens. No claim is made that the complete application has been production-certified.
