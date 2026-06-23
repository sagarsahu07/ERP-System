import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sun, Sunset, Moon } from "lucide-react";
import { toast } from "sonner";

const SHIFTS = ["Morning", "Afternoon", "Night"];
const ICONS = { Morning: Sun, Afternoon: Sunset, Night: Moon };

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [employees, setEmployees] = useState([]);

  const load = async () => {
    const [s, e] = await Promise.all([api.get("/shifts"), api.get("/employees")]);
    setShifts(s.data.items);
    setEmployees(e.data.items);
  };
  useEffect(() => { load(); }, []);

  const reassign = async (emp, shift) => {
    if (emp.shift === shift) return;
    try {
      await api.post("/shifts/assign", { employee_id: emp.id, shift });
      toast.success(`${emp.name} moved to ${shift}`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <>
      <PageHeader overline="Operations" title="Shift Management" />
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shifts.map((s) => {
            const Icon = ICONS[s.name];
            return (
              <div key={s.name} className="grid-card p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="overline">{s.name} Shift</div>
                    <div className="text-3xl font-black tracking-tight mt-2" style={{ fontFamily: "Chivo" }}>{s.employees}</div>
                    <div className="text-xs text-muted-foreground mt-1">employees assigned</div>
                  </div>
                  <div className="w-10 h-10 flex items-center justify-center border border-border" style={{ borderRadius: 2 }}>
                    <Icon className="w-5 h-5 text-[#00A86B]" />
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs font-mono text-muted-foreground">{s.start} — {s.end}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="overline">Roster</div>
            <div className="text-lg font-bold tracking-tight" style={{ fontFamily: "Chivo" }}>Employee Shift Assignment</div>
          </div>
          <table className="erp-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Department</th><th>Position</th><th>Shift</th><th className="text-right">Reassign</th></tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-xs text-muted-foreground">{e.employee_code}</td>
                  <td className="font-semibold">{e.name}</td>
                  <td>{e.department}</td>
                  <td>{e.position}</td>
                  <td><span className="pill pill-info">{e.shift}</span></td>
                  <td className="text-right">
                    <Select value={e.shift} onValueChange={(v) => reassign(e, v)}>
                      <SelectTrigger className="rounded-none w-36 ml-auto" data-testid={`shift-select-${e.employee_code}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{SHIFTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
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
