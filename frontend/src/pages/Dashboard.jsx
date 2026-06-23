import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import {
  Users, UserCheck, UserX, Clock, CalendarClock, IndianRupee, AlertTriangle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

const DEPT_COLORS = ["#00A86B", "#1E40AF", "#F59E0B", "#9F1239", "#7C3AED", "#0EA5E9"];

const legendFormatter = (v) => <span className="text-xs">{v}</span>;

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="grid-card p-5" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div className="overline">{label}</div>
        <div className="w-8 h-8 flex items-center justify-center border border-border" style={{ borderRadius: 2, color: accent }}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="stat-num mt-3">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then(({ data }) => setStats(data));
  }, []);

  if (!stats) {
    return (
      <div className="p-8 text-sm font-mono text-muted-foreground">Loading dashboard…</div>
    );
  }

  return (
    <>
      <PageHeader
        overline={`Workforce overview · ${stats.date}`}
        title="Operations Dashboard"
      />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Total Employees" value={stats.total_employees} icon={Users} accent="#09090B" />
          <StatCard label="Present Today" value={stats.present_today} icon={UserCheck} accent="#00A86B" />
          <StatCard label="Late Today" value={stats.late_today} icon={Clock} accent="#F59E0B" />
          <StatCard label="Absent Today" value={stats.absent_today} icon={UserX} accent="#9F1239" />
          <StatCard label="Pending Leaves" value={stats.pending_leaves} icon={AlertTriangle} accent="#1E40AF" />
          <StatCard label="Monthly Payroll" value={`₹${Math.round(stats.monthly_salary).toLocaleString()}`} icon={IndianRupee} accent="#00A86B" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="grid-card p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="overline">Last 7 days</div>
                <div className="text-lg font-bold tracking-tight" style={{ fontFamily: "Chivo" }}>Attendance Trend</div>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#00A86B]"></span> Present</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-[#F59E0B]"></span> Late</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.attendance_trend}>
                <CartesianGrid stroke="#E4E4E7" strokeDasharray="2 4" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="#71717A" fontSize={11} />
                <YAxis stroke="#71717A" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #18181B", fontSize: 12 }} />
                <Line type="monotone" dataKey="present" stroke="#00A86B" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="late" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid-card p-6">
            <div className="overline">Shift Coverage</div>
            <div className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "Chivo" }}>Active Shifts</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.shifts}>
                <CartesianGrid stroke="#E4E4E7" strokeDasharray="2 4" />
                <XAxis dataKey="name" stroke="#71717A" fontSize={11} />
                <YAxis stroke="#71717A" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #18181B", fontSize: 12 }} />
                <Bar dataKey="count" fill="#00A86B" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="overline">Workforce</div>
              <div className="text-lg font-bold tracking-tight" style={{ fontFamily: "Chivo" }}>Department Distribution</div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={stats.departments} dataKey="count" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {stats.departments.map((d, i) => (
                    <Cell key={d.name} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #18181B", fontSize: 12 }} />
                <Legend formatter={legendFormatter} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              {stats.departments.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between py-2 border-b border-border text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3" style={{ background: DEPT_COLORS[i % DEPT_COLORS.length] }}></span>
                    <span className="font-medium">{d.name}</span>
                  </div>
                  <span className="font-mono text-muted-foreground">{d.count}</span>
                </div>
              ))}
              {stats.departments.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">No data</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
