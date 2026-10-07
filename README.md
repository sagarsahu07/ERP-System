# Smart Employee Management & Attendance ERP

A full-stack Employee Management and Attendance ERP designed for retail-store operations. The system provides role-based employee management, attendance tracking, leave management, shift management, payroll generation, payslip PDF generation, dashboards, and attendance reports.

> **Important:** The face-recognition feature in the current version is a **simulated/prototype AI workflow**. The UI shows a face-scan experience, but there is no real CNN/DeepFace/face-recognition model performing facial identification yet.

## 1. Project Overview

### Problem Statement

Managing employees in a retail organization using spreadsheets or separate systems can make attendance, leave approvals, shifts, payroll, and reporting difficult to maintain.

This project provides a centralized web-based ERP where an administrator can manage the workforce and employees can access their own HR information.

### Main Objective

To build a centralized Employee Management and Attendance ERP that:

- Stores employee information in one system
- Provides secure admin/employee login
- Tracks daily attendance and working hours
- Supports simulated group face-recognition attendance
- Manages leave applications and approvals
- Manages employee shifts
- Generates monthly payroll from attendance data
- Generates downloadable payslips in PDF
- Provides dashboard analytics
- Exports attendance reports as CSV

## 2. User Roles

### Admin / HR Manager

The admin can:

- View the operations dashboard
- Add, edit and delete employees
- Search/filter employees
- Register face samples (prototype counter)
- Mark employee check-in/check-out
- Run simulated group face-recognition attendance
- View attendance history
- Approve/reject leave requests
- Manage employee shifts
- Generate monthly payroll
- Download payslips
- Export attendance reports
- View analytics

### Employee

An employee can:

- Log in securely
- View personal dashboard
- View profile information
- View attendance
- Apply for leave
- View leave status/balance
- View payslips
- Download their own payslips

Admin-only pages are protected from employee users.

## 3. Major Modules

### 3.1 Authentication & Authorization

Authentication is implemented using:

- FastAPI backend
- JWT tokens
- bcrypt password hashing
- HTTP-only authentication cookie
- Bearer-token fallback
- Role-based authorization

The backend checks the user's role before allowing admin-only operations.

Example:

`require_admin()` prevents normal employees from accessing admin-only endpoints.

### 3.2 Employee Management

The Employee module supports:

- Employee creation
- Auto-generated employee code such as `EMP1001`
- Name, email, phone and address
- Department and position
- Monthly salary
- Joining date
- Shift
- Emergency contact
- Leave balance
- Active/Inactive status
- Linked employee login account
- Employee update/delete
- Search and filters

The system automatically creates a linked employee login when enabled.

### 3.3 Attendance Management

Attendance supports:

- Manual check-in
- Manual check-out
- Automatic working-hour calculation
- Present/Late status
- Attendance history
- Date filters
- Status filters
- Employee-specific attendance view

The system gives a 10-minute grace period for shift start time when calculating late status.

Attendance records contain information such as:

- Employee
- Employee code
- Department
- Shift
- Date
- Check-in
- Check-out
- Working hours
- Status
- Attendance method

### 3.4 AI / Face Recognition Prototype

The project contains a prototype for group attendance using a face-recognition style workflow.

Current flow:

1. Admin opens Group Check-In.
2. The UI displays a scanning animation.
3. Employees are selected/simulated as recognized.
4. The selected employee IDs are sent to the backend.
5. The backend creates/updates attendance records.
6. The attendance method is stored as `face_recognition`.

**Current limitation:** The project does not yet contain a real facial recognition model or face embedding pipeline. The current implementation is a simulation/prototype intended to demonstrate the planned workflow.

### 3.5 Leave Management

Employees can apply for:

- Casual Leave
- Sick Leave
- Earned Leave
- Unpaid Leave

The system:

- Validates start/end dates
- Calculates number of leave days
- Creates a Pending request
- Allows admin to Approve or Reject
- Updates leave balance when approved

### 3.6 Shift Management

Three predefined shifts are available:

| Shift | Time |
|---|---|
| Morning | 07:00 – 15:00 |
| Afternoon | 15:00 – 23:00 |
| Night | 23:00 – 07:00 |

Admin can assign/reassign employees to shifts.

### 3.7 Payroll

Monthly payroll is generated using:

- Base salary
- Attendance/working days
- Total working hours
- Overtime hours
- Overtime pay
- Bonus
- Deduction
- Net pay

Current overtime calculation uses an 8-hour working-day baseline and a 1.5x hourly overtime multiplier.

Formula used conceptually:

`Net Pay = Base Salary + Overtime Pay + Bonus - Deduction`

### 3.8 Payslip PDF

The backend uses ReportLab to generate an A4 PDF payslip.

The payslip contains:

- Employee name
- Employee code
- Department
- Payroll period
- Working days
- Total hours
- Overtime hours
- Base salary
- Overtime pay
- Bonus
- Deduction
- Net pay

### 3.9 Dashboard & Analytics

Admin dashboard provides:

- Total employees
- Present today
- Late today
- Absent today
- Pending leaves
- Monthly payroll
- 7-day attendance trend
- Shift distribution
- Department distribution

Charts are implemented using Recharts.

### 3.10 Reports

The current reporting module provides attendance CSV export.

Export fields include:

- Date
- Employee Code
- Name
- Department
- Shift
- Status
- Check In
- Check Out
- Hours

## 4. Technology Stack

### Frontend

- React 19
- React Router
- Tailwind CSS
- Shadcn/Radix UI components
- Axios
- Recharts
- Sonner
- Lucide React
- React Hook Form

### Backend

- Python
- FastAPI
- Pydantic
- Uvicorn
- PyJWT
- bcrypt
- ReportLab
- python-dotenv

### Database

- MongoDB
- Motor async MongoDB driver

### Architecture

The project follows a client-server architecture:

```text
React Frontend
      |
      | HTTP / REST API
      v
FastAPI Backend
      |
      v
MongoDB Database
```

Additional services:

```text
FastAPI
 ├── JWT Authentication
 ├── Employee Management
 ├── Attendance
 ├── Leaves
 ├── Shifts
 ├── Payroll
 ├── Payslip PDF
 └── Reports
```

## 5. Database Design

The system uses five main MongoDB collections.

### users

Stores login/account information.

Important fields:

- id
- email
- password_hash
- name
- role
- employee_id

### employees

Stores employee master data.

Important fields:

- id
- employee_code
- name
- email
- department
- position
- salary
- shift
- joining_date
- leave_balance
- status
- face_registered
- face_samples

### attendance

Stores daily attendance.

Important fields:

- employee_id
- employee_name
- employee_code
- department
- shift
- date
- check_in
- check_out
- hours
- status
- method

### leaves

Stores leave applications.

Important fields:

- employee_id
- leave_type
- start_date
- end_date
- days
- reason
- status
- note

### payroll

Stores generated monthly payroll.

Important fields:

- employee_id
- month_key
- working_days
- total_hours
- overtime_hours
- base_salary
- overtime_pay
- bonus
- deduction
- net_pay
- status

## 6. Important API Endpoints

All APIs use the `/api` prefix.

### Authentication

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me
```

### Employees

```text
GET    /api/employees
GET    /api/employees/{id}
POST   /api/employees
PATCH  /api/employees/{id}
DELETE /api/employees/{id}
POST   /api/employees/{id}/face-register
```

### Attendance

```text
POST /api/attendance/check-in
POST /api/attendance/check-out
POST /api/attendance/group
GET  /api/attendance
GET  /api/attendance/today
```

### Leaves

```text
POST /api/leaves
GET  /api/leaves
POST /api/leaves/{id}/decision
```

### Shifts

```text
GET  /api/shifts
GET  /api/shifts/{name}/employees
POST /api/shifts/assign
```

### Payroll

```text
POST /api/payroll/generate
GET  /api/payroll
GET  /api/payroll/{id}/payslip
```

### Dashboard / Reports

```text
GET /api/dashboard/stats
GET /api/reports/attendance.csv
```

## 7. Frontend Page Structure

```text
src/
├── App.js
├── context/
│   └── AuthContext.jsx
├── components/
│   ├── Layout.jsx
│   ├── ProtectedRoute.jsx
│   └── ui/
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Employees.jsx
│   ├── Attendance.jsx
│   ├── Leaves.jsx
│   ├── Shifts.jsx
│   ├── Payroll.jsx
│   ├── Reports.jsx
│   └── MyDashboard.jsx
├── lib/
│   ├── api.js
│   └── utils.js
└── constants/
```

## 8. Backend Structure

```text
backend/
├── server.py
├── requirements.txt
└── tests/
    └── test_erp_api.py
```

The current backend keeps the API implementation in a single `server.py` file. For a larger production system, it would be better to split it into separate routers such as:

```text
auth/
employees/
attendance/
leaves/
shifts/
payroll/
reports/
```

## 9. Authentication Flow

```text
User enters email/password
          |
          v
React Login Page
          |
          | POST /api/auth/login
          v
FastAPI
          |
          v
MongoDB user lookup
          |
          v
bcrypt password verification
          |
          v
JWT generated
          |
          v
Frontend stores token
          |
          v
Protected API requests
```

The frontend sends the JWT as a Bearer token. The backend validates the token and loads the current user.

## 10. Attendance Flow

### Manual Attendance

```text
Admin selects employee
        |
        v
Check-In
        |
        v
Backend checks employee
        |
        v
Compare check-in time with shift
        |
        +---- within grace period -> Present
        |
        +---- after grace period -> Late
        |
        v
Save attendance in MongoDB
```

### Check-Out

```text
Check-Out
   |
   v
Find today's attendance
   |
   v
Calculate:
hours = check_out - check_in
   |
   v
Update attendance record
```

## 11. Payroll Flow

```text
Select Month
     |
     v
Generate Payroll
     |
     v
Read Active Employees
     |
     v
Read Attendance
     |
     +--> Working Days
     |
     +--> Total Hours
     |
     +--> Overtime Hours
     |
     v
Calculate Overtime Pay
     |
     v
Add Bonus / Deduction
     |
     v
Calculate Net Pay
     |
     v
Save Payroll
     |
     v
Download Payslip PDF
```

## 12. Security Features

The project includes:

- Password hashing using bcrypt
- JWT-based authentication
- Token expiry
- Protected frontend routes
- Role-based access control
- Admin-only backend dependencies
- Employee-specific data filtering
- Pydantic request validation
- MongoDB unique indexes

### Production improvements recommended

Before real deployment:

- Store secrets only in environment variables
- Rotate the JWT secret
- Use HTTPS
- Set authentication cookies to `secure=True`
- Restrict CORS to the actual frontend domain
- Add stronger password policy
- Add audit logs
- Add rate limiting
- Add real face-recognition security/privacy controls

## 13. Setup

### Backend

Create a Python virtual environment and install:

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file with values similar to:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=smart_employee_erp
CORS_ORIGINS=http://localhost:3000
JWT_SECRET=replace_with_a_strong_random_secret
ADMIN_EMAIL=admin@dmart.co
ADMIN_PASSWORD=change_this_password
```

Start the backend:

```bash
uvicorn server:app --reload --port 8000
```

### Frontend

```bash
cd frontend
yarn install
```

Set:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
```

Then run:

```bash
yarn start
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://localhost:8000
```

## 14. Demo Accounts

The application seeds demo accounts on backend startup when the database is empty.

### Admin

```text
Email: admin@dmart.co
Password: admin123
```

### Employee

Example:

```text
Email: priya@dmart.co
Password: employee123
```

For a real deployment, these credentials must be changed.

## 15. Testing

The project includes backend API tests covering:

- Authentication
- Role authorization
- Employee CRUD
- Attendance
- Group attendance
- Leaves
- Shifts
- Payroll
- Payslip PDF
- Dashboard statistics
- CSV reports

The included iteration test report records:

```text
Backend: 23/23 tests passed
Backend success rate: 100%
Frontend: major flows verified
```

## 16. Current Limitations

The current version is a functional academic/prototype ERP and has some limitations:

1. Face recognition is simulated; there is no real ML model.
2. Face registration currently increments a sample counter instead of creating face embeddings.
3. Inventory management is not implemented.
4. Notifications are not implemented.
5. Excel export is not implemented; attendance export is CSV.
6. Payroll has a known month-end implementation that should use the actual calendar month length.
7. Backend is currently concentrated in one large `server.py`.
8. Production CORS and HTTPS cookie settings need tightening.

## 17. Future Scope

### Phase 1 — Real AI Attendance

Integrate:

- OpenCV
- Face embeddings
- DeepFace or `face_recognition`
- Face detection
- Employee face registration
- Real-time webcam recognition
- Confidence threshold
- Anti-spoofing/liveness detection

### Phase 2 — Complete ERP

Add:

- Inventory management
- Asset assignment
- Task management
- Performance tracking
- Audit logs
- Notifications
- Holiday calendar

### Phase 3 — Advanced Analytics

Add:

- Attendance prediction
- Attrition analytics
- Workforce forecasting
- Overtime analysis
- Department productivity metrics

### Phase 4 — Production Deployment

Add:

- Docker
- CI/CD
- HTTPS
- Cloud MongoDB
- Cloud deployment
- Monitoring
- Automated backups

## 18. Academic Project Explanation

### One-line explanation

> “Smart Employee Management & Attendance ERP is a full-stack web application that centralizes employee management, attendance, leaves, shifts, payroll and reporting, with a prototype AI-based face-recognition attendance workflow.”

### 30-second explanation

> “Our project is a Smart Employee Management and Attendance ERP designed mainly for retail organizations. It has two roles: Admin and Employee. Admin can manage employees, attendance, shifts, leaves, payroll and reports, while employees can view their own attendance, apply for leaves and download payslips. We used React for the frontend, FastAPI for the backend and MongoDB for database storage. Authentication is handled using JWT and bcrypt. We also designed an AI face-recognition attendance module; in the current academic version the recognition part is simulated, while the backend is ready to store attendance using the face-recognition method.”

### Problem solved

> “The project reduces manual HR work by bringing employee records, attendance, leave management, shift allocation, payroll and reporting into one centralized system.”

### Why MongoDB?

> “MongoDB was selected because the employee, attendance and payroll records contain flexible document-based data, and MongoDB integrates well with Python through the Motor asynchronous driver.”

### Why FastAPI?

> “FastAPI provides a fast Python-based REST API framework, automatic request validation through Pydantic, and a clean dependency-based approach for authentication and role authorization.”

### Why React?

> “React provides reusable UI components and makes it easier to build separate dashboards for Admin and Employee roles.”

## 19. Project Name

Recommended academic title:

**Smart Employee Management & Attendance ERP**

Alternative:

**Smart Employee Management and AI-Assisted Attendance ERP**

The second title should only be used with the clarification that the current face-recognition component is a prototype/simulation.

---

## License / Academic Use

This project is intended as an academic/prototype implementation and can be extended for production use after adding the security, privacy, real AI recognition and operational modules described above.

