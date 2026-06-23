import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";
import { Calendar, Clock, Wallet, UserCheck } from "lucide-react";

export default function MyDashboard() {
  const { user } = useAuth();
  const [att, setAtt] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [pay, setPay] = useState([]);
  const [emp, setEmp] = useState(null);

  useEffect(() => {
    api.get("/attendance").then(({ data }) => setAtt(data.items));
    api.get("/leaves").then(({ data }) => setLeaves(data.items));
    api.get("/payroll").then(({ data }) => setPay(data.items));
    if (user?.employee_id) api.get(`/employees/${user.employee_id}`).then(({ data }) => setEmp(data));
  }, [user]);

  const presentCount = att.filter(a => a.status === "Present" || a.status === "Late").length;
  const lateCount = att.filter(a => a.status === "Late").length;
  const pendingLeaves = leaves.filter(l => l.status === "Pending").length;
  const lastPay = pay[0]?.net_pay || 0;

  return (
    <>
      <PageHeader overline={`Hello, ${user?.name?.split(" ")[0]}`} title="My Workspace" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Days Present" value={presentCount} icon={UserCheck} />
          <StatTile label="Late Days" value={lateCount} icon={Clock} />
          <StatTile label="Pending Leaves" value={pendingLeaves} icon={Calendar} />
          <StatTile label="Last Net Pay" value={`₹${lastPay.toLocaleString()}`} icon={Wallet} />
        </div>

        {emp && (
          <div className="grid-card p-6">
            <div className="overline">Profile</div>
            <div className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "Chivo" }}>{emp.name}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <Info label="Employee Code" value={emp.employee_code} />
              <Info label="Department" value={emp.department} />
              <Info label="Position" value={emp.position} />
              <Info label="Shift" value={emp.shift} />
              <Info label="Joining Date" value={emp.joining_date} />
              <Info label="Leave Balance" value={`${emp.leave_balance} days`} />
              <Info label="Phone" value={emp.phone || "—"} />
              <Info label="Emergency" value={emp.emergency_contact || "—"} />
              <Info label="Monthly Salary" value={`₹${Number(emp.salary).toLocaleString()}`} />
            </div>
          </div>
        )}

        <div className="grid-card p-6">
          <div className="overline">Recent</div>
          <div className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "Chivo" }}>Latest Attendance</div>
          <table className="erp-table">
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {att.slice(0, 8).map((r) => (
                <tr key={r.id + r.date}>
                  <td className="font-mono text-xs">{r.date}</td>
                  <td className="font-mono text-xs">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                  <td className="font-mono text-xs">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                  <td className="font-mono">{r.hours || "—"}</td>
                  <td>
                    {r.status === "Present" && <span className="pill pill-success">Present</span>}
                    {r.status === "Late" && <span className="pill pill-warn">Late</span>}
                  </td>
                </tr>
              ))}
              {att.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-6">No records yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="grid-card p-5">
      <div className="flex items-start justify-between">
        <div className="overline">{label}</div>
        <Icon className="w-4 h-4 text-[#00A86B]" />
      </div>
      <div className="stat-num mt-3">{value}</div>
    </div>
  );
}
function Info({ label, value }) {
  return (
    <div>
      <div className="overline mb-1">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
