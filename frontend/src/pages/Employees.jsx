import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, ScanFace, X } from "lucide-react";
import { toast } from "sonner";

const DEPARTMENTS = ["Cashier", "Floor Staff", "Billing", "Inventory", "Customer Service", "Security", "Management"];
const SHIFTS = ["Morning", "Afternoon", "Night"];

function EmployeeForm({ initial, onSave, onCancel }) {
  const [data, setData] = useState(initial || {
    name: "", email: "", phone: "", address: "", department: "Cashier",
    position: "", salary: 20000, shift: "Morning", emergency_contact: "",
    leave_balance: 20, status: "Active", create_login: true, password: "employee123",
  });
  const upd = (k, v) => setData((d) => ({ ...d, [k]: v }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Full name" required>
        <Input data-testid="emp-name-input" value={data.name} onChange={(e) => upd("name", e.target.value)} className="rounded-none" />
      </Field>
      <Field label="Email" required>
        <Input data-testid="emp-email-input" type="email" value={data.email} onChange={(e) => upd("email", e.target.value)} disabled={!!initial} className="rounded-none" />
      </Field>
      <Field label="Phone">
        <Input value={data.phone} onChange={(e) => upd("phone", e.target.value)} className="rounded-none" />
      </Field>
      <Field label="Emergency contact">
        <Input value={data.emergency_contact} onChange={(e) => upd("emergency_contact", e.target.value)} className="rounded-none" />
      </Field>
      <Field label="Department">
        <Select value={data.department} onValueChange={(v) => upd("department", v)}>
          <SelectTrigger data-testid="emp-department-select" className="rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Position">
        <Input value={data.position} onChange={(e) => upd("position", e.target.value)} className="rounded-none" />
      </Field>
      <Field label="Shift">
        <Select value={data.shift} onValueChange={(v) => upd("shift", v)}>
          <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>{SHIFTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Monthly salary (₹)">
        <Input data-testid="emp-salary-input" type="number" value={data.salary} onChange={(e) => upd("salary", parseFloat(e.target.value || 0))} className="rounded-none" />
      </Field>
      <Field label="Leave balance">
        <Input type="number" value={data.leave_balance} onChange={(e) => upd("leave_balance", parseInt(e.target.value || 0))} className="rounded-none" />
      </Field>
      <Field label="Status">
        <Select value={data.status} onValueChange={(v) => upd("status", v)}>
          <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Address" className="md:col-span-2">
        <Input value={data.address} onChange={(e) => upd("address", e.target.value)} className="rounded-none" />
      </Field>
      {!initial && (
        <Field label="Initial login password (default: employee123)" className="md:col-span-2">
          <Input
            placeholder="employee123"
            value={data.password}
            onChange={(e) => upd("password", e.target.value)}
            className="rounded-none"
          />
        </Field>
      )}
      <div className="md:col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="outline" className="rounded-none" onClick={onCancel} data-testid="emp-form-cancel">Cancel</Button>
        <Button
          data-testid="emp-form-save"
          className="rounded-none bg-[#00A86B] hover:bg-[#008B58]"
          onClick={() => onSave(data)}
        >Save</Button>
      </div>
    </div>
  );
}

function Field({ label, children, className = "", required }) {
  return (
    <div className={className}>
      <label className="overline block mb-2">{label}{required && <span className="text-[#9F1239] ml-1">*</span>}</label>
      {children}
    </div>
  );
}

export default function Employees() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("All");
  const [shift, setShift] = useState("All");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (dept !== "All") params.department = dept;
    if (shift !== "All") params.shift = shift;
    const { data } = await api.get("/employees", { params });
    setItems(data.items);
    setLoading(false);
  }, [q, dept, shift]);

  useEffect(() => { load(); }, [load]);

  const save = async (data) => {
    try {
      if (editing) {
        await api.patch(`/employees/${editing.id}`, data);
        toast.success("Employee updated");
      } else {
        await api.post("/employees", data);
        toast.success("Employee created");
      }
      setOpen(false); setEditing(null);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const del = async (emp) => {
    if (!window.confirm(`Delete ${emp.name}?`)) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      toast.success("Employee deleted");
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const registerFace = async (emp) => {
    try {
      const { data } = await api.post(`/employees/${emp.id}/face-register`);
      toast.success(`Face sample ${data.face_samples}/5 captured`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <>
      <PageHeader
        overline="Workforce"
        title="Employees"
        action={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button data-testid="add-employee-btn" className="rounded-none bg-[#00A86B] hover:bg-[#008B58]">
                <Plus className="w-4 h-4 mr-1" /> Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl rounded-none" data-testid="emp-dialog">
              <DialogHeader>
                <DialogTitle className="font-black tracking-tight text-2xl" style={{ fontFamily: "Chivo" }}>
                  {editing ? "Edit employee" : "Add new employee"}
                </DialogTitle>
              </DialogHeader>
              <EmployeeForm initial={editing} onSave={save} onCancel={() => { setOpen(false); setEditing(null); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-5">
        <div className="grid-card p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="emp-search-input"
              placeholder="Search by name, email, code, position…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-none pl-9"
            />
          </div>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="rounded-none w-44" data-testid="emp-filter-department"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All departments</SelectItem>
              {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={shift} onValueChange={setShift}>
            <SelectTrigger className="rounded-none w-36" data-testid="emp-filter-shift"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All shifts</SelectItem>
              {SHIFTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          {(q || dept !== "All" || shift !== "All") && (
            <Button variant="ghost" className="rounded-none" onClick={() => { setQ(""); setDept("All"); setShift("All"); }}>
              <X className="w-4 h-4 mr-1" /> Clear
            </Button>
          )}
        </div>

        <div className="grid-card overflow-hidden">
          <table className="erp-table" data-testid="employees-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Department</th>
                <th>Position</th>
                <th>Shift</th>
                <th>Salary</th>
                <th>Status</th>
                <th>Face</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-8 font-mono text-xs">Loading…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={9} className="text-center text-muted-foreground py-8">No employees match the filters.</td></tr>
              )}
              {items.map((e) => (
                <tr key={e.id} data-testid={`emp-row-${e.employee_code}`}>
                  <td className="font-mono text-xs text-muted-foreground">{e.employee_code}</td>
                  <td>
                    <div className="font-semibold">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </td>
                  <td>{e.department}</td>
                  <td>{e.position}</td>
                  <td><span className="pill pill-info">{e.shift}</span></td>
                  <td className="font-mono">₹{Number(e.salary).toLocaleString()}</td>
                  <td>
                    {e.status === "Active"
                      ? <span className="pill pill-success">Active</span>
                      : <span className="pill pill-muted">Inactive</span>}
                  </td>
                  <td>
                    {e.face_registered
                      ? <span className="pill pill-success">✓ {e.face_samples}/5</span>
                      : <span className="pill pill-muted">{e.face_samples || 0}/5</span>}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="rounded-none w-8 h-8" onClick={() => registerFace(e)} title="Capture face sample" data-testid={`emp-face-${e.employee_code}`}>
                        <ScanFace className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="rounded-none w-8 h-8" onClick={() => { setEditing(e); setOpen(true); }} data-testid={`emp-edit-${e.employee_code}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="rounded-none w-8 h-8 text-[#9F1239]" onClick={() => del(e)} data-testid={`emp-delete-${e.employee_code}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
