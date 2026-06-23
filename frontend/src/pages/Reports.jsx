import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";

export default function Reports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => { api.get("/dashboard/stats").then(({ data }) => setStats(data)); }, []);

  const csvUrl = () => {
    const p = new URLSearchParams();
    if (from) p.set("date_from", from);
    if (to) p.set("date_to", to);
    return `${API_BASE}/reports/attendance.csv?${p.toString()}`;
  };

  const downloadCsv = async () => {
    const res = await fetch(csvUrl(), {
      credentials: "include",
      headers: { Authorization: `Bearer ${localStorage.getItem("erp_token") || ""}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "attendance_report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader overline="Analytics" title="Reports" />
      <div className="p-8 space-y-6">
        <div className="grid-card p-5">
          <div className="overline mb-3">Attendance Export</div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="overline block mb-2">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-none w-44" data-testid="report-from" />
            </div>
            <div>
              <label className="overline block mb-2">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-none w-44" data-testid="report-to" />
            </div>
            <Button onClick={downloadCsv} className="rounded-none bg-[#00A86B] hover:bg-[#008B58]" data-testid="report-export">
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="grid-card p-6">
              <div className="overline">Weekly</div>
              <div className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "Chivo" }}>Attendance Distribution</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.attendance_trend}>
                  <CartesianGrid stroke="#E4E4E7" strokeDasharray="2 4" />
                  <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} stroke="#71717A" fontSize={11} />
                  <YAxis stroke="#71717A" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #18181B", fontSize: 12 }} />
                  <Bar dataKey="present" stackId="a" fill="#00A86B" />
                  <Bar dataKey="late" stackId="a" fill="#F59E0B" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid-card p-6">
              <div className="overline">Departments</div>
              <div className="text-lg font-bold tracking-tight mb-4" style={{ fontFamily: "Chivo" }}>Headcount</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.departments} layout="vertical">
                  <CartesianGrid stroke="#E4E4E7" strokeDasharray="2 4" />
                  <XAxis type="number" stroke="#71717A" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#71717A" fontSize={11} width={120} />
                  <Tooltip contentStyle={{ borderRadius: 2, border: "1px solid #18181B", fontSize: 12 }} />
                  <Bar dataKey="count" fill="#1E40AF" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
