"""Backend API tests for Retail ERP - auth, employees, attendance, leaves, shifts, payroll, dashboard, reports."""
import os
import io
import pytest
import requests
from datetime import datetime

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://emp-analytics-ai.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN = {"email": "admin@dmart.co", "password": "admin123"}
EMPLOYEE = {"email": "priya@dmart.co", "password": "employee123"}


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def employee_token():
    r = requests.post(f"{API}/auth/login", json=EMPLOYEE, timeout=20)
    assert r.status_code == 200, f"employee login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def H(token):
    return {"Authorization": f"Bearer {token}"}


# ---------------- Auth ----------------
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": "admin@dmart.co", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_login_admin_cookie_set(self):
        r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=10)
        assert r.status_code == 200
        # httpOnly cookie present
        assert "access_token" in r.cookies, f"cookies: {r.cookies}"

    def test_me_with_bearer(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_logout(self, admin_token):
        r = requests.post(f"{API}/auth/logout", headers=H(admin_token), timeout=10)
        assert r.status_code == 200


# ---------------- Role enforcement ----------------
class TestRoles:
    def test_employee_cannot_create_employee(self, employee_token):
        r = requests.post(f"{API}/employees", headers=H(employee_token), json={
            "name": "TEST_x", "email": "TEST_x@x.com"
        }, timeout=10)
        assert r.status_code == 403

    def test_employee_cannot_check_in_others(self, employee_token):
        r = requests.post(f"{API}/attendance/check-in", headers=H(employee_token), json={"employee_id": "x"}, timeout=10)
        assert r.status_code == 403

    def test_employee_cannot_export_csv(self, employee_token):
        r = requests.get(f"{API}/reports/attendance.csv", headers=H(employee_token), timeout=10)
        assert r.status_code == 403


# ---------------- Employees ----------------
class TestEmployees:
    def test_seeded_employees(self, admin_token):
        r = requests.get(f"{API}/employees", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["total"] >= 6
        emails = [e["email"] for e in data["items"]]
        for em in ["priya@dmart.co", "ramesh@dmart.co", "anita@dmart.co", "suresh@dmart.co", "neha@dmart.co", "arjun@dmart.co"]:
            assert em in emails

    def test_create_update_delete(self, admin_token):
        payload = {
            "name": "TEST_John",
            "email": f"test_john_{datetime.utcnow().timestamp()}@dmart.co",
            "department": "Cashier",
            "position": "Cashier",
            "salary": 20000,
            "shift": "Morning",
            "create_login": False,
        }
        r = requests.post(f"{API}/employees", headers=H(admin_token), json=payload, timeout=10)
        assert r.status_code == 200, r.text
        emp = r.json()
        emp_id = emp["id"]
        assert emp["name"] == "TEST_John"
        assert emp["employee_code"].startswith("EMP")

        # GET back
        rg = requests.get(f"{API}/employees/{emp_id}", headers=H(admin_token), timeout=10)
        assert rg.status_code == 200
        assert rg.json()["email"] == payload["email"]

        # PATCH
        rp = requests.patch(f"{API}/employees/{emp_id}", headers=H(admin_token), json={"salary": 25000}, timeout=10)
        assert rp.status_code == 200
        assert rp.json()["salary"] == 25000

        # Face register
        rf = requests.post(f"{API}/employees/{emp_id}/face-register", headers=H(admin_token), timeout=10)
        assert rf.status_code == 200
        assert rf.json()["face_samples"] == 1

        # DELETE
        rd = requests.delete(f"{API}/employees/{emp_id}", headers=H(admin_token), timeout=10)
        assert rd.status_code == 200

        rg2 = requests.get(f"{API}/employees/{emp_id}", headers=H(admin_token), timeout=10)
        assert rg2.status_code == 404

    def test_duplicate_email_rejected(self, admin_token):
        r = requests.post(f"{API}/employees", headers=H(admin_token), json={
            "name": "Dup", "email": "priya@dmart.co", "create_login": False,
        }, timeout=10)
        assert r.status_code == 400


# ---------------- Attendance ----------------
class TestAttendance:
    @pytest.fixture(scope="class")
    def some_emp(self, admin_token):
        r = requests.get(f"{API}/employees", headers=H(admin_token), timeout=10)
        items = r.json()["items"]
        # pick one not Priya (used by employee tests)
        for e in items:
            if e["email"] != "priya@dmart.co":
                return e
        return items[0]

    def test_check_in_then_out(self, admin_token, some_emp):
        # Cleanup-friendly: try check-in; if already checked-in, skip check-in and try check-out
        ci = requests.post(f"{API}/attendance/check-in", headers=H(admin_token),
                           json={"employee_id": some_emp["id"]}, timeout=10)
        assert ci.status_code in (200, 400)
        if ci.status_code == 200:
            assert ci.json()["status"] in ("Present", "Late")

        co = requests.post(f"{API}/attendance/check-out", headers=H(admin_token),
                           json={"employee_id": some_emp["id"]}, timeout=10)
        assert co.status_code in (200, 400)

    def test_today_endpoint(self, admin_token):
        r = requests.get(f"{API}/attendance/today", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_group_attendance(self, admin_token):
        # Use two employees that probably aren't checked in via previous test (use the last two)
        emp = requests.get(f"{API}/employees", headers=H(admin_token), timeout=10).json()["items"]
        ids = [e["id"] for e in emp[-2:]]
        r = requests.post(f"{API}/attendance/group", headers=H(admin_token),
                          json={"employee_ids": ids, "mode": "check_in"}, timeout=10)
        assert r.status_code == 200
        assert "results" in r.json()
        assert len(r.json()["results"]) == len(ids)

    def test_list_attendance(self, admin_token):
        r = requests.get(f"{API}/attendance", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        assert "items" in r.json()


# ---------------- Leaves ----------------
class TestLeaves:
    def test_employee_apply_and_admin_decide(self, admin_token, employee_token):
        # employee applies
        r = requests.post(f"{API}/leaves", headers=H(employee_token), json={
            "leave_type": "Casual",
            "start_date": "2026-02-01",
            "end_date": "2026-02-02",
            "reason": "TEST_personal",
        }, timeout=10)
        assert r.status_code == 200, r.text
        leave = r.json()
        leave_id = leave["id"]
        assert leave["status"] == "Pending"
        assert leave["days"] == 2

        # admin sees in pending
        rl = requests.get(f"{API}/leaves?status=Pending", headers=H(admin_token), timeout=10)
        assert rl.status_code == 200
        assert any(x["id"] == leave_id for x in rl.json()["items"])

        # approve
        rd = requests.post(f"{API}/leaves/{leave_id}/decision", headers=H(admin_token),
                           json={"status": "Approved", "note": "ok"}, timeout=10)
        assert rd.status_code == 200
        assert rd.json()["status"] == "Approved"

        # cannot decide twice
        rd2 = requests.post(f"{API}/leaves/{leave_id}/decision", headers=H(admin_token),
                            json={"status": "Rejected"}, timeout=10)
        assert rd2.status_code == 400

    def test_invalid_dates(self, employee_token):
        r = requests.post(f"{API}/leaves", headers=H(employee_token), json={
            "start_date": "2026-02-10", "end_date": "2026-02-01", "leave_type": "Casual",
        }, timeout=10)
        assert r.status_code == 400


# ---------------- Shifts ----------------
class TestShifts:
    def test_list_shifts(self, admin_token):
        r = requests.get(f"{API}/shifts", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        names = [s["name"] for s in r.json()["items"]]
        assert {"Morning", "Afternoon", "Night"}.issubset(set(names))

    def test_assign_shift(self, admin_token):
        emp = requests.get(f"{API}/employees", headers=H(admin_token), timeout=10).json()["items"][0]
        original = emp["shift"]
        new_shift = "Afternoon" if original != "Afternoon" else "Morning"
        r = requests.post(f"{API}/shifts/assign", headers=H(admin_token),
                          json={"employee_id": emp["id"], "shift": new_shift}, timeout=10)
        assert r.status_code == 200
        # verify
        rg = requests.get(f"{API}/employees/{emp['id']}", headers=H(admin_token), timeout=10)
        assert rg.json()["shift"] == new_shift
        # revert
        requests.post(f"{API}/shifts/assign", headers=H(admin_token),
                      json={"employee_id": emp["id"], "shift": original}, timeout=10)


# ---------------- Payroll ----------------
class TestPayroll:
    def test_generate_and_list(self, admin_token):
        now = datetime.utcnow()
        r = requests.post(f"{API}/payroll/generate", headers=H(admin_token),
                          json={"month": now.month, "year": now.year}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] >= 6
        first = data["items"][0]
        for k in ["base_salary", "overtime_pay", "bonus", "deduction", "net_pay"]:
            assert k in first

        rl = requests.get(f"{API}/payroll", headers=H(admin_token), timeout=10)
        assert rl.status_code == 200
        assert len(rl.json()["items"]) >= 6

    def test_payslip_pdf(self, admin_token):
        rl = requests.get(f"{API}/payroll", headers=H(admin_token), timeout=10).json()["items"]
        assert rl, "no payroll"
        pid = rl[0]["id"]
        r = requests.get(f"{API}/payroll/{pid}/payslip", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")


# ---------------- Dashboard / Reports ----------------
class TestDashboardReports:
    def test_dashboard_stats(self, admin_token):
        r = requests.get(f"{API}/dashboard/stats", headers=H(admin_token), timeout=10)
        assert r.status_code == 200
        data = r.json()
        for k in ["total_employees", "present_today", "late_today", "absent_today",
                  "pending_leaves", "monthly_salary", "shifts", "attendance_trend", "departments"]:
            assert k in data
        assert len(data["attendance_trend"]) == 7

    def test_csv_export(self, admin_token):
        r = requests.get(f"{API}/reports/attendance.csv", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        assert "csv" in r.headers.get("content-type", "")
        first_line = r.text.split("\n")[0]
        assert "Date" in first_line and "Employee Code" in first_line
