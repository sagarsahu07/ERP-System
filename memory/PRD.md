# Smart Employee Management & Attendance ERP — PRD

## Original Problem
Full-stack ERP for retail stores (D-Mart inspired) covering employees, attendance (with AI group face-recognition), shifts, leaves, payroll, analytics, reports.

## Architecture
- **Backend**: FastAPI + MongoDB (`/app/backend/server.py`). JWT auth (httpOnly cookie + Bearer fallback), bcrypt. ReportLab for payslip PDFs.
- **Frontend**: React 19 + Tailwind + Shadcn/UI + Recharts + Sonner (toasts). Swiss/high-contrast retail theme (Chivo + IBM Plex Sans), green `#00A86B` brand accent.
- **DB collections**: users, employees, attendance, leaves, payroll. Unique indexes on emails, attendance per (employee_id+date), payroll per (employee_id+month_key).

## User Personas
- **Admin** — HR manager / store owner. Manages employees, takes group attendance, approves leaves, runs payroll, exports reports.
- **Employee** — store staff. Views own profile, attendance, leave balance, applies for leave, downloads payslips.

## What's been implemented (2026-02 / iteration 1)
- **Phase 1 — Auth & Dashboard**: JWT login, admin/employee roles, sidebar, dashboard with KPIs + 7-day attendance trend + shift coverage + department pie.
- **Phase 2 — Employees**: list/search/filter (department, shift), add (with auto-generated EMP code + linked user), edit, delete; per-employee face-sample capture progress (mock).
- **Phase 3 — Attendance**: manual per-row check-in / check-out, `late` detection vs. shift start, history with date+status filters, **simulated AI group face-recognition modal** with animated scan overlay + bounding boxes.
- **Phase 4 — Leaves**: employee apply, admin approve/reject, balance clamps at 0, status filter, types (Casual/Sick/Earned/Unpaid).
- **Phase 5 — Shifts**: 3 fixed shifts (Morning/Afternoon/Night) with times + counts, roster with reassign dropdown.
- **Phase 6 — Payroll**: monthly generation from attendance data (working days + OT hours), bonus/deduction maps, downloadable A4 payslip PDF (ReportLab).
- **Phase 7 — Reports**: attendance CSV export, dashboard analytics charts.
- **Phase 8 — AI Face Recognition**: UI complete; backend `/api/attendance/group` endpoint accepts employee IDs and marks attendance with `method="face_recognition"`. ML model **MOCKED** (frontend selects employees, no real CNN).

## Demo accounts (seeded)
- Admin: `admin@dmart.co` / `admin123`
- Employees: `priya|ramesh|anita|suresh|neha|arjun@dmart.co` / `employee123`

## Test status
- Backend pytest: 23/23 passing
- Frontend Playwright flows: all major flows verified

## Backlog / Next priorities
- **P0** Real face recognition (Phase 8) — integrate DeepFace/face_recognition or cloud API; capture embeddings on employee face-register endpoint.
- **P0** Inventory module per employee (assignment tracking) — extension into operations ERP.
- **P1** Phase 9 Notifications (email via Resend, optional Telegram/WhatsApp) — payroll generated, leave decision alerts.
- **P1** Excel export (.xlsx via openpyxl) in addition to CSV; PDF monthly attendance summary.
- **P1** Settings/Profile page for admin to change own password, manage company settings, holiday calendar.
- **P2** Phase 10 — performance ratings, task assignments, audit log, docker/CI-CD.
- **P2** Tighten CORS to explicit origins, set `secure=True` cookie in HTTPS prod.
- **P2** Split `server.py` into routers (currently ~900 lines).
- **P2** Payroll date_to upper bound — use `calendar.monthrange` instead of `-31`.

## Files of interest
- `/app/backend/server.py` — single-file backend
- `/app/frontend/src/pages/{Login,Dashboard,Employees,Attendance,Leaves,Shifts,Payroll,Reports,MyDashboard}.jsx`
- `/app/frontend/src/components/Layout.jsx`
- `/app/memory/test_credentials.md`
