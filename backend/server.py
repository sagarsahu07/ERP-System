from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from io import BytesIO
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# -------------------- DB --------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# -------------------- App --------------------
app = FastAPI(title="Retail ERP API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# -------------------- Helpers --------------------

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_str() -> str:
    return now_utc().date().isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, role: str, kind: str = "access", expires_minutes: int = 60 * 8) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "type": kind,
        "exp": now_utc() + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 8,
        path="/",
    )

# -------------------- Models --------------------

class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str
    employee_id: Optional[str] = None


class EmployeeIn(BaseModel):
    name: str
    email: EmailStr
    phone: str = ""
    address: str = ""
    department: str = "General"
    position: str = "Staff"
    salary: float = 0
    joining_date: Optional[str] = None
    shift: Literal["Morning", "Afternoon", "Night"] = "Morning"
    emergency_contact: str = ""
    photo_url: str = ""
    status: Literal["Active", "Inactive"] = "Active"
    leave_balance: int = 20
    create_login: bool = True
    password: Optional[str] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    salary: Optional[float] = None
    shift: Optional[Literal["Morning", "Afternoon", "Night"]] = None
    emergency_contact: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[Literal["Active", "Inactive"]] = None
    leave_balance: Optional[int] = None


class CheckInIn(BaseModel):
    employee_id: str
    note: Optional[str] = ""


class CheckOutIn(BaseModel):
    employee_id: str


class GroupAttendanceIn(BaseModel):
    employee_ids: List[str]
    mode: Literal["check_in", "check_out"] = "check_in"
    image_b64: Optional[str] = None


class LeaveIn(BaseModel):
    employee_id: Optional[str] = None  # filled by server for employee role
    leave_type: Literal["Casual", "Sick", "Earned", "Unpaid"] = "Casual"
    start_date: str
    end_date: str
    reason: str = ""


class LeaveDecision(BaseModel):
    status: Literal["Approved", "Rejected"]
    note: Optional[str] = ""


class ShiftAssignIn(BaseModel):
    employee_id: str
    shift: Literal["Morning", "Afternoon", "Night"]


class PayrollGenerateIn(BaseModel):
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    bonus_map: dict = Field(default_factory=dict)  # employee_id -> bonus
    deduction_map: dict = Field(default_factory=dict)


# Shift definitions (static)
SHIFT_TIMES = {
    "Morning": {"start": "07:00", "end": "15:00"},
    "Afternoon": {"start": "15:00", "end": "23:00"},
    "Night": {"start": "23:00", "end": "07:00"},
}

# -------------------- Auth Routes --------------------

@api_router.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["role"])
    set_auth_cookie(response, token)
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "employee_id": user.get("employee_id"),
        },
    }


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


# -------------------- Employees --------------------

def _employee_doc(data: dict) -> dict:
    return {k: v for k, v in data.items() if k != "_id"}


@api_router.get("/employees")
async def list_employees(
    q: Optional[str] = None,
    department: Optional[str] = None,
    shift: Optional[str] = None,
    status: Optional[str] = None,
    _: dict = Depends(get_current_user),
):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
            {"employee_code": {"$regex": q, "$options": "i"}},
            {"position": {"$regex": q, "$options": "i"}},
        ]
    if department and department != "All":
        query["department"] = department
    if shift and shift != "All":
        query["shift"] = shift
    if status and status != "All":
        query["status"] = status
    cursor = db.employees.find(query, {"_id": 0}).sort("created_at", -1)
    items = await cursor.to_list(1000)
    return {"items": items, "total": len(items)}


@api_router.get("/employees/departments")
async def departments(_: dict = Depends(get_current_user)):
    items = await db.employees.distinct("department")
    return {"items": sorted([i for i in items if i])}


@api_router.get("/employees/{emp_id}")
async def get_employee(emp_id: str, _: dict = Depends(get_current_user)):
    emp = await db.employees.find_one({"id": emp_id}, {"_id": 0})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp


@api_router.post("/employees")
async def create_employee(body: EmployeeIn, _: dict = Depends(require_admin)):
    existing = await db.employees.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Employee with this email already exists")
    emp_id = str(uuid.uuid4())
    count = await db.employees.count_documents({})
    code = f"EMP{1000 + count + 1}"
    doc = body.model_dump()
    doc.pop("create_login", None)
    raw_password = doc.pop("password", None) or "employee123"
    doc.update({
        "id": emp_id,
        "employee_code": code,
        "email": body.email.lower(),
        "joining_date": body.joining_date or today_str(),
        "created_at": now_utc().isoformat(),
        "face_registered": False,
        "face_samples": 0,
    })
    await db.employees.insert_one(doc)
    if body.create_login:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": body.email.lower(),
            "password_hash": hash_password(raw_password),
            "name": body.name,
            "role": "employee",
            "employee_id": emp_id,
            "created_at": now_utc().isoformat(),
        })
    return await db.employees.find_one({"id": emp_id}, {"_id": 0})


@api_router.patch("/employees/{emp_id}")
async def update_employee(emp_id: str, body: EmployeeUpdate, _: dict = Depends(require_admin)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.employees.update_one({"id": emp_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return await db.employees.find_one({"id": emp_id}, {"_id": 0})


@api_router.delete("/employees/{emp_id}")
async def delete_employee(emp_id: str, _: dict = Depends(require_admin)):
    emp = await db.employees.find_one({"id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    await db.employees.delete_one({"id": emp_id})
    await db.users.delete_many({"employee_id": emp_id})
    return {"ok": True}


@api_router.post("/employees/{emp_id}/face-register")
async def register_face(emp_id: str, _: dict = Depends(require_admin)):
    emp = await db.employees.find_one({"id": emp_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    samples = emp.get("face_samples", 0) + 1
    await db.employees.update_one(
        {"id": emp_id},
        {"$set": {"face_samples": samples, "face_registered": samples >= 5}},
    )
    return {"face_samples": samples, "face_registered": samples >= 5}


# -------------------- Attendance --------------------

def _calc_hours(check_in_iso: str, check_out_iso: str) -> float:
    a = datetime.fromisoformat(check_in_iso)
    b = datetime.fromisoformat(check_out_iso)
    return round((b - a).total_seconds() / 3600, 2)


def _is_late(check_in_iso: str, shift: str) -> bool:
    try:
        t = datetime.fromisoformat(check_in_iso).time()
        start_str = SHIFT_TIMES.get(shift, SHIFT_TIMES["Morning"])["start"]
        h, m = [int(x) for x in start_str.split(":")]
        return (t.hour, t.minute) > (h, m + 10)  # 10 min grace
    except Exception:
        return False


@api_router.post("/attendance/check-in")
async def check_in(body: CheckInIn, _: dict = Depends(require_admin)):
    emp = await db.employees.find_one({"id": body.employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    d = today_str()
    existing = await db.attendance.find_one({"employee_id": body.employee_id, "date": d})
    if existing and existing.get("check_in"):
        raise HTTPException(status_code=400, detail="Already checked in today")
    ts = now_utc().isoformat()
    late = _is_late(ts, emp.get("shift", "Morning"))
    record = {
        "id": existing.get("id") if existing else str(uuid.uuid4()),
        "employee_id": body.employee_id,
        "employee_name": emp["name"],
        "employee_code": emp["employee_code"],
        "department": emp["department"],
        "shift": emp.get("shift", "Morning"),
        "date": d,
        "check_in": ts,
        "check_out": None,
        "hours": 0.0,
        "status": "Late" if late else "Present",
        "method": "manual",
        "note": body.note or "",
    }
    await db.attendance.update_one(
        {"employee_id": body.employee_id, "date": d},
        {"$set": record}, upsert=True,
    )
    return record


@api_router.post("/attendance/check-out")
async def check_out(body: CheckOutIn, _: dict = Depends(require_admin)):
    d = today_str()
    existing = await db.attendance.find_one({"employee_id": body.employee_id, "date": d})
    if not existing or not existing.get("check_in"):
        raise HTTPException(status_code=400, detail="No check-in record for today")
    if existing.get("check_out"):
        raise HTTPException(status_code=400, detail="Already checked out today")
    ts = now_utc().isoformat()
    hours = _calc_hours(existing["check_in"], ts)
    await db.attendance.update_one(
        {"employee_id": body.employee_id, "date": d},
        {"$set": {"check_out": ts, "hours": hours}},
    )
    return await db.attendance.find_one({"employee_id": body.employee_id, "date": d}, {"_id": 0})


@api_router.post("/attendance/group")
async def group_attendance(body: GroupAttendanceIn, _: dict = Depends(require_admin)):
    """Simulated AI group attendance. Frontend supplies which employees were 'recognized'."""
    results = []
    d = today_str()
    for eid in body.employee_ids:
        emp = await db.employees.find_one({"id": eid})
        if not emp:
            continue
        existing = await db.attendance.find_one({"employee_id": eid, "date": d})
        ts = now_utc().isoformat()
        if body.mode == "check_in":
            if existing and existing.get("check_in"):
                results.append({"employee_id": eid, "name": emp["name"], "status": "already_checked_in"})
                continue
            late = _is_late(ts, emp.get("shift", "Morning"))
            record = {
                "id": existing.get("id") if existing else str(uuid.uuid4()),
                "employee_id": eid,
                "employee_name": emp["name"],
                "employee_code": emp["employee_code"],
                "department": emp["department"],
                "shift": emp.get("shift", "Morning"),
                "date": d,
                "check_in": ts,
                "check_out": None,
                "hours": 0.0,
                "status": "Late" if late else "Present",
                "method": "face_recognition",
                "note": "",
            }
            await db.attendance.update_one({"employee_id": eid, "date": d}, {"$set": record}, upsert=True)
            results.append({"employee_id": eid, "name": emp["name"], "status": "checked_in", "late": late})
        else:
            if not existing or not existing.get("check_in"):
                results.append({"employee_id": eid, "name": emp["name"], "status": "no_checkin"})
                continue
            if existing.get("check_out"):
                results.append({"employee_id": eid, "name": emp["name"], "status": "already_checked_out"})
                continue
            hours = _calc_hours(existing["check_in"], ts)
            await db.attendance.update_one(
                {"employee_id": eid, "date": d},
                {"$set": {"check_out": ts, "hours": hours, "method": "face_recognition"}},
            )
            results.append({"employee_id": eid, "name": emp["name"], "status": "checked_out", "hours": hours})
    return {"results": results}


@api_router.get("/attendance")
async def list_attendance(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if user.get("role") == "employee":
        employee_id = user.get("employee_id")
    if employee_id:
        query["employee_id"] = employee_id
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    if status and status != "All":
        query["status"] = status
    items = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    return {"items": items, "total": len(items)}


@api_router.get("/attendance/today")
async def today_attendance(_: dict = Depends(get_current_user)):
    d = today_str()
    items = await db.attendance.find({"date": d}, {"_id": 0}).to_list(1000)
    return {"items": items, "date": d}


# -------------------- Leaves --------------------

@api_router.post("/leaves")
async def apply_leave(body: LeaveIn, user: dict = Depends(get_current_user)):
    employee_id = body.employee_id
    if user.get("role") == "employee":
        employee_id = user.get("employee_id")
    if not employee_id:
        raise HTTPException(status_code=400, detail="employee_id required")
    emp = await db.employees.find_one({"id": employee_id})
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    try:
        start = date.fromisoformat(body.start_date)
        end = date.fromisoformat(body.end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    if end < start:
        raise HTTPException(status_code=400, detail="End date before start date")
    days = (end - start).days + 1
    doc = {
        "id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "employee_name": emp["name"],
        "employee_code": emp["employee_code"],
        "leave_type": body.leave_type,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "days": days,
        "reason": body.reason,
        "status": "Pending",
        "note": "",
        "created_at": now_utc().isoformat(),
        "decided_at": None,
    }
    await db.leaves.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/leaves")
async def list_leaves(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if user.get("role") == "employee":
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    if status and status != "All":
        query["status"] = status
    items = await db.leaves.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"items": items, "total": len(items)}


@api_router.post("/leaves/{leave_id}/decision")
async def decide_leave(leave_id: str, body: LeaveDecision, _: dict = Depends(require_admin)):
    leave = await db.leaves.find_one({"id": leave_id})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave["status"] != "Pending":
        raise HTTPException(status_code=400, detail="Leave already decided")
    update = {"status": body.status, "note": body.note or "", "decided_at": now_utc().isoformat()}
    await db.leaves.update_one({"id": leave_id}, {"$set": update})
    if body.status == "Approved":
        # clamp to 0 minimum
        emp = await db.employees.find_one({"id": leave["employee_id"]})
        new_balance = max(0, int(emp.get("leave_balance", 0)) - int(leave["days"]))
        await db.employees.update_one(
            {"id": leave["employee_id"]},
            {"$set": {"leave_balance": new_balance}},
        )
    return await db.leaves.find_one({"id": leave_id}, {"_id": 0})


# -------------------- Shifts --------------------

@api_router.get("/shifts")
async def list_shifts(_: dict = Depends(get_current_user)):
    out = []
    for name, times in SHIFT_TIMES.items():
        count = await db.employees.count_documents({"shift": name, "status": "Active"})
        out.append({
            "name": name,
            "start": times["start"],
            "end": times["end"],
            "employees": count,
        })
    return {"items": out}


@api_router.get("/shifts/{name}/employees")
async def shift_employees(name: str, _: dict = Depends(get_current_user)):
    items = await db.employees.find({"shift": name}, {"_id": 0}).to_list(1000)
    return {"items": items}


@api_router.post("/shifts/assign")
async def assign_shift(body: ShiftAssignIn, _: dict = Depends(require_admin)):
    result = await db.employees.update_one(
        {"id": body.employee_id},
        {"$set": {"shift": body.shift}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"ok": True, "shift": body.shift}


# -------------------- Payroll --------------------

@api_router.post("/payroll/generate")
async def generate_payroll(body: PayrollGenerateIn, _: dict = Depends(require_admin)):
    month_key = f"{body.year:04d}-{body.month:02d}"
    employees = await db.employees.find({"status": "Active"}, {"_id": 0}).to_list(1000)
    created = []
    for emp in employees:
        # working days this month from attendance
        date_from = f"{month_key}-01"
        # cheap "to" = end of month boundary string-wise
        date_to = f"{month_key}-31"
        att_count = await db.attendance.count_documents({
            "employee_id": emp["id"],
            "date": {"$gte": date_from, "$lte": date_to},
            "status": {"$in": ["Present", "Late"]},
        })
        total_hours_pipeline = await db.attendance.aggregate([
            {"$match": {"employee_id": emp["id"], "date": {"$gte": date_from, "$lte": date_to}}},
            {"$group": {"_id": None, "hours": {"$sum": "$hours"}}},
        ]).to_list(1)
        total_hours = float(total_hours_pipeline[0]["hours"]) if total_hours_pipeline else 0.0
        overtime_hours = max(0.0, total_hours - att_count * 8)
        base = float(emp.get("salary", 0))
        per_hour = base / 22 / 8 if base else 0
        overtime_pay = round(overtime_hours * per_hour * 1.5, 2)
        bonus = float(body.bonus_map.get(emp["id"], 0))
        deduction = float(body.deduction_map.get(emp["id"], 0))
        net = round(base + overtime_pay + bonus - deduction, 2)
        record = {
            "id": str(uuid.uuid4()),
            "employee_id": emp["id"],
            "employee_name": emp["name"],
            "employee_code": emp["employee_code"],
            "department": emp["department"],
            "month": body.month,
            "year": body.year,
            "month_key": month_key,
            "working_days": att_count,
            "total_hours": round(total_hours, 2),
            "overtime_hours": round(overtime_hours, 2),
            "base_salary": base,
            "overtime_pay": overtime_pay,
            "bonus": bonus,
            "deduction": deduction,
            "net_pay": net,
            "status": "Generated",
            "created_at": now_utc().isoformat(),
        }
        await db.payroll.update_one(
            {"employee_id": emp["id"], "month_key": month_key},
            {"$set": record},
            upsert=True,
        )
        created.append(record)
    return {"items": created, "count": len(created)}


@api_router.get("/payroll")
async def list_payroll(
    month_key: Optional[str] = None,
    employee_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    query = {}
    if user.get("role") == "employee":
        query["employee_id"] = user.get("employee_id")
    elif employee_id:
        query["employee_id"] = employee_id
    if month_key:
        query["month_key"] = month_key
    items = await db.payroll.find(query, {"_id": 0}).sort("month_key", -1).to_list(1000)
    return {"items": items}


@api_router.get("/payroll/{payroll_id}/payslip")
async def download_payslip(payroll_id: str, user: dict = Depends(get_current_user)):
    record = await db.payroll.find_one({"id": payroll_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Payroll not found")
    if user.get("role") == "employee" and record["employee_id"] != user.get("employee_id"):
        raise HTTPException(status_code=403, detail="Forbidden")

    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas
    from reportlab.lib.units import cm

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 2 * cm

    c.setFont("Helvetica-Bold", 16)
    c.drawString(2 * cm, y, "RETAIL ERP — PAYSLIP")
    y -= 0.8 * cm
    c.setFont("Helvetica", 9)
    c.drawString(2 * cm, y, f"Period: {record['month_key']}")
    y -= 1.2 * cm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(2 * cm, y, "Employee Details")
    y -= 0.6 * cm
    c.setFont("Helvetica", 10)
    lines = [
        f"Name: {record['employee_name']}",
        f"Employee Code: {record['employee_code']}",
        f"Department: {record['department']}",
        f"Working Days: {record['working_days']}",
        f"Total Hours: {record['total_hours']}",
        f"Overtime Hours: {record['overtime_hours']}",
    ]
    for line in lines:
        c.drawString(2 * cm, y, line)
        y -= 0.5 * cm

    y -= 0.5 * cm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(2 * cm, y, "Earnings & Deductions")
    y -= 0.6 * cm
    c.setFont("Helvetica", 10)
    rows = [
        ("Base Salary", record["base_salary"]),
        ("Overtime Pay", record["overtime_pay"]),
        ("Bonus", record["bonus"]),
        ("Deduction", -record["deduction"]),
    ]
    for label, val in rows:
        c.drawString(2 * cm, y, label)
        c.drawRightString(width - 2 * cm, y, f"INR {val:,.2f}")
        y -= 0.5 * cm

    y -= 0.3 * cm
    c.setLineWidth(1)
    c.line(2 * cm, y, width - 2 * cm, y)
    y -= 0.6 * cm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(2 * cm, y, "NET PAY")
    c.drawRightString(width - 2 * cm, y, f"INR {record['net_pay']:,.2f}")

    c.showPage()
    c.save()
    buffer.seek(0)
    headers = {"Content-Disposition": f"attachment; filename=payslip_{record['employee_code']}_{record['month_key']}.pdf"}
    return StreamingResponse(buffer, media_type="application/pdf", headers=headers)


# -------------------- Dashboard / Reports --------------------

@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    d = today_str()
    total_employees = await db.employees.count_documents({"status": "Active"})
    present = await db.attendance.count_documents({"date": d, "status": "Present"})
    late = await db.attendance.count_documents({"date": d, "status": "Late"})
    checked_in = present + late
    absent = max(0, total_employees - checked_in)
    pending_leaves = await db.leaves.count_documents({"status": "Pending"})
    shifts = []
    for name in SHIFT_TIMES.keys():
        count = await db.employees.count_documents({"shift": name, "status": "Active"})
        shifts.append({"name": name, "count": count})

    # Last 7 days attendance trend
    trend = []
    for i in range(6, -1, -1):
        day = (now_utc() - timedelta(days=i)).date().isoformat()
        p = await db.attendance.count_documents({"date": day, "status": "Present"})
        late = await db.attendance.count_documents({"date": day, "status": "Late"})
        trend.append({"date": day, "present": p, "late": late})

    # Department distribution
    dept_pipeline = await db.employees.aggregate([
        {"$match": {"status": "Active"}},
        {"$group": {"_id": "$department", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]).to_list(20)
    departments = [{"name": x["_id"] or "Unassigned", "count": x["count"]} for x in dept_pipeline]

    # Monthly salary total
    month_key = now_utc().strftime("%Y-%m")
    salary_pipeline = await db.payroll.aggregate([
        {"$match": {"month_key": month_key}},
        {"$group": {"_id": None, "total": {"$sum": "$net_pay"}}},
    ]).to_list(1)
    monthly_salary = float(salary_pipeline[0]["total"]) if salary_pipeline else 0.0

    return {
        "total_employees": total_employees,
        "present_today": present,
        "late_today": late,
        "absent_today": absent,
        "pending_leaves": pending_leaves,
        "monthly_salary": monthly_salary,
        "shifts": shifts,
        "attendance_trend": trend,
        "departments": departments,
        "date": d,
    }


@api_router.get("/reports/attendance.csv")
async def export_attendance(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    _: dict = Depends(require_admin),
):
    query = {}
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    items = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(5000)

    def gen():
        yield "Date,Employee Code,Name,Department,Shift,Status,Check In,Check Out,Hours\n"
        for r in items:
            yield (
                f"{r.get('date','')},{r.get('employee_code','')},{r.get('employee_name','')},"
                f"{r.get('department','')},{r.get('shift','')},{r.get('status','')},"
                f"{r.get('check_in','')},{r.get('check_out','')},{r.get('hours','')}\n"
            )
    headers = {"Content-Disposition": "attachment; filename=attendance_report.csv"}
    return StreamingResponse(gen(), media_type="text/csv", headers=headers)


# -------------------- Startup --------------------

@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.employees.create_index("email", unique=True)
    await db.employees.create_index("employee_code")
    await db.attendance.create_index([("employee_id", 1), ("date", 1)], unique=True)
    await db.attendance.create_index("date")
    await db.leaves.create_index([("employee_id", 1), ("status", 1)])
    await db.payroll.create_index([("employee_id", 1), ("month_key", 1)], unique=True)

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@dmart.co").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": now_utc().isoformat(),
        })
    else:
        if not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password)}},
            )

    # Seed demo employees if none exist
    if await db.employees.count_documents({}) == 0:
        demo = [
            {"name": "Priya Sharma", "email": "priya@dmart.co", "department": "Cashier", "position": "Senior Cashier", "salary": 28000, "shift": "Morning", "phone": "9000000001"},
            {"name": "Ramesh Kumar", "email": "ramesh@dmart.co", "department": "Floor Staff", "position": "Aisle Lead", "salary": 24000, "shift": "Afternoon", "phone": "9000000002"},
            {"name": "Anita Iyer", "email": "anita@dmart.co", "department": "Billing", "position": "Billing Executive", "salary": 26000, "shift": "Morning", "phone": "9000000003"},
            {"name": "Suresh Patel", "email": "suresh@dmart.co", "department": "Inventory", "position": "Stock Manager", "salary": 32000, "shift": "Night", "phone": "9000000004"},
            {"name": "Neha Gupta", "email": "neha@dmart.co", "department": "Customer Service", "position": "Service Lead", "salary": 27000, "shift": "Afternoon", "phone": "9000000005"},
            {"name": "Arjun Mehta", "email": "arjun@dmart.co", "department": "Floor Staff", "position": "Helper", "salary": 18000, "shift": "Morning", "phone": "9000000006"},
        ]
        for i, e in enumerate(demo):
            eid = str(uuid.uuid4())
            await db.employees.insert_one({
                **e,
                "id": eid,
                "employee_code": f"EMP{1001 + i}",
                "address": "Mumbai, MH",
                "joining_date": "2024-01-15",
                "emergency_contact": "9999999999",
                "photo_url": "",
                "status": "Active",
                "leave_balance": 20,
                "created_at": now_utc().isoformat(),
                "face_registered": False,
                "face_samples": 0,
            })
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": e["email"],
                "password_hash": hash_password("employee123"),
                "name": e["name"],
                "role": "employee",
                "employee_id": eid,
                "created_at": now_utc().isoformat(),
            })


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://erp-system-sagar.netlify.app",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
