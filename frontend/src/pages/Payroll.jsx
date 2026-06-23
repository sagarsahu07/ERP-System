import { useEffect, useState, useCallback } from "react";
import { api, formatApiError, API_BASE } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

function monthKeyNow() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastMonths(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function Payroll() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [monthKey, setMonthKey] = useState(monthKeyNow());
  const [busy, setBusy] = useState(false);
  const months = lastMonths(6);

  const load = async () => {
    const { data } = await api.get("/payroll", { params: { month_key: monthKey } });
    setItems(data.items);
  };
  useEffect(() => { load(); }, [monthKey]);

  const generate = async () => {
    setBusy(true);
    try {
      const [year, month] = monthKey.split("-").map(Number);
      const { data } = await api.post("/payroll/generate", { year, month, bonus_map: {}, deduction_map: {} });
      toast.success(`Generated payroll for ${data.count} employees`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
    setBusy(false);
  };

  const downloadPayslip = async (id, code) => {
    try {
      const res = await fetch(`${API_BASE}/payroll/${id}/payslip`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${localStorage.getItem("erp_token") || ""}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `payslip_${code}_${monthKey}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Could not download payslip");
    }
  };

  const totalNet = items.reduce((s, r) => s + (r.net_pay || 0), 0);

  return (
    <>
      <PageHeader
        overline="Compensation"
        title={isAdmin ? "Payroll" : "My Payslips"}
        action={isAdmin && (
          <Button data-testid="generate-payroll-btn" disabled={busy} onClick={generate} className="rounded-none bg-[#00A86B] hover:bg-[#008B58]">
            <Sparkles className="w-4 h-4 mr-1" /> {busy ? "Generating…" : `Generate ${monthKey}`}
          </Button>
        )}
      />
      <div className="p-8 space-y-5">
        <div className="grid-card p-4 flex flex-wrap items-center gap-3">
          <Select value={monthKey} onValueChange={setMonthKey}>
            <SelectTrigger className="rounded-none w-44" data-testid="payroll-month-select"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          {isAdmin && items.length > 0 && (
            <div className="ml-auto text-sm">
              <span className="overline mr-2">Net total</span>
              <span className="font-mono font-bold text-lg">₹{totalNet.toLocaleString()}</span>
            </div>
          )}
        </div>

        <div className="grid-card overflow-hidden">
          <table className="erp-table" data-testid="payroll-table">
            <thead>
              <tr>
                {isAdmin && <th>Code</th>}
                <th>{isAdmin ? "Employee" : "Period"}</th>
                <th>Days</th><th>OT Hrs</th><th>Base</th><th>OT Pay</th><th>Bonus</th><th>Deduction</th><th>Net</th>
                <th className="text-right">Payslip</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={isAdmin ? 10 : 9} className="text-center py-8 text-muted-foreground">No payroll for {monthKey}. {isAdmin && "Click Generate."}</td></tr>}
              {items.map((p) => (
                <tr key={p.id}>
                  {isAdmin && <td className="font-mono text-xs text-muted-foreground">{p.employee_code}</td>}
                  <td className="font-semibold">{isAdmin ? p.employee_name : p.month_key}</td>
                  <td className="font-mono">{p.working_days}</td>
                  <td className="font-mono">{p.overtime_hours}</td>
                  <td className="font-mono">₹{p.base_salary.toLocaleString()}</td>
                  <td className="font-mono">₹{p.overtime_pay.toLocaleString()}</td>
                  <td className="font-mono">₹{p.bonus.toLocaleString()}</td>
                  <td className="font-mono text-[#9F1239]">-₹{p.deduction.toLocaleString()}</td>
                  <td className="font-mono font-bold">₹{p.net_pay.toLocaleString()}</td>
                  <td className="text-right">
                    <Button size="sm" variant="outline" className="rounded-none border-zinc-900" onClick={() => downloadPayslip(p.id, p.employee_code)} data-testid={`payslip-${p.employee_code}`}>
                      <Download className="w-3.5 h-3.5 mr-1" /> PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
