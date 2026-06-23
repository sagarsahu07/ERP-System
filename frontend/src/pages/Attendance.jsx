import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ScanFace, CheckCircle2, LogOut, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  return isAdmin ? <AdminAttendance /> : <EmployeeAttendance />;
}

function AdminAttendance() {
  const [employees, setEmployees] = useState([]);
  const [today, setToday] = useState([]);
  const [history, setHistory] = useState([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMode, setScanMode] = useState("check_in");
  const [recognized, setRecognized] = useState([]);
  const [scanning, setScanning] = useState(false);

  const filtersToParams = useCallback(() => {
    const p = {};
    if (filterStatus !== "All") p.status = filterStatus;
    if (filterFrom) p.date_from = filterFrom;
    if (filterTo) p.date_to = filterTo;
    return p;
  }, [filterStatus, filterFrom, filterTo]);

  const loadAll = useCallback(async () => {
    const [e, t, h] = await Promise.all([
      api.get("/employees"),
      api.get("/attendance/today"),
      api.get("/attendance", { params: filtersToParams() }),
    ]);
    setEmployees(e.data.items);
    setToday(t.data.items);
    setHistory(h.data.items);
  }, [filtersToParams]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => {
    api.get("/attendance", { params: filtersToParams() }).then(({ data }) => setHistory(data.items));
  }, [filtersToParams]);

  const checkedInIds = useMemo(() => new Set(today.filter(t => t.check_in && !t.check_out).map(t => t.employee_id)), [today]);
  const checkedOutIds = useMemo(() => new Set(today.filter(t => t.check_out).map(t => t.employee_id)), [today]);

  const handleCheckIn = async (emp) => {
    try {
      await api.post("/attendance/check-in", { employee_id: emp.id });
      toast.success(`${emp.name} checked in`);
      loadAll();
    } catch (e) { toast.error(formatApiError(e)); }
  };
  const handleCheckOut = async (emp) => {
    try {
      await api.post("/attendance/check-out", { employee_id: emp.id });
      toast.success(`${emp.name} checked out`);
      loadAll();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  // Simulated face recognition: pick random subset of employees
  const startScan = (mode) => {
    setScanMode(mode);
    setScanOpen(true);
    setRecognized([]);
    setScanning(true);
    const pool = employees.filter((e) =>
      mode === "check_in" ? !checkedInIds.has(e.id) && !checkedOutIds.has(e.id) : checkedInIds.has(e.id)
    );
    // Simulate: take 3-5 random eligible employees with delay
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const pick = shuffled.slice(0, Math.min(5, Math.max(2, shuffled.length)));
    pick.forEach((e, i) => {
      setTimeout(() => {
        setRecognized((r) => [...r, e]);
        if (i === pick.length - 1) setScanning(false);
      }, 700 + i * 500);
    });
    if (pick.length === 0) setScanning(false);
  };

  const confirmGroup = async () => {
    if (recognized.length === 0) { setScanOpen(false); return; }
    try {
      const { data } = await api.post("/attendance/group", {
        employee_ids: recognized.map((r) => r.id),
        mode: scanMode,
      });
      const ok = data.results.filter((r) => r.status === "checked_in" || r.status === "checked_out").length;
      toast.success(`${ok} employees marked via face-recognition`);
      setScanOpen(false);
      loadAll();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <>
      <PageHeader
        overline="Today"
        title="Attendance Control"
        action={
          <div className="flex gap-2">
            <Button data-testid="group-checkin-btn" className="rounded-none bg-[#00A86B] hover:bg-[#008B58]" onClick={() => startScan("check_in")}>
              <ScanFace className="w-4 h-4 mr-1" /> Group Check-In
            </Button>
            <Button data-testid="group-checkout-btn" variant="outline" className="rounded-none border-zinc-900" onClick={() => startScan("check_out")}>
              <ScanFace className="w-4 h-4 mr-1" /> Group Check-Out
            </Button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        <Tabs defaultValue="today">
          <TabsList className="rounded-none">
            <TabsTrigger value="today" className="rounded-none" data-testid="att-tab-today">Today</TabsTrigger>
            <TabsTrigger value="history" className="rounded-none" data-testid="att-tab-history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="mt-5 space-y-5">
            <div className="grid-card">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <div className="overline">Live</div>
                  <div className="text-lg font-bold tracking-tight" style={{ fontFamily: "Chivo" }}>All Employees · Manual Mark</div>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  Checked in: {today.filter(t => t.check_in && !t.check_out).length} · Checked out: {today.filter(t => t.check_out).length}
                </div>
              </div>
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Shift</th><th>Check-In</th><th>Check-Out</th><th>Hours</th><th>Status</th><th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => {
                    const rec = today.find(t => t.employee_id === e.id);
                    return (
                      <tr key={e.id}>
                        <td className="font-mono text-xs text-muted-foreground">{e.employee_code}</td>
                        <td className="font-semibold">{e.name}</td>
                        <td><span className="pill pill-info">{e.shift}</span></td>
                        <td className="font-mono text-xs">{rec?.check_in ? new Date(rec.check_in).toLocaleTimeString() : "—"}</td>
                        <td className="font-mono text-xs">{rec?.check_out ? new Date(rec.check_out).toLocaleTimeString() : "—"}</td>
                        <td className="font-mono">{rec?.hours || "—"}</td>
                        <td>
                          {!rec && <span className="pill pill-muted">Pending</span>}
                          {rec?.status === "Present" && <span className="pill pill-success">Present</span>}
                          {rec?.status === "Late" && <span className="pill pill-warn">Late</span>}
                          {rec?.check_out && <span className="pill pill-muted ml-1">Out</span>}
                        </td>
                        <td className="text-right">
                          {!rec?.check_in && (
                            <Button size="sm" className="rounded-none bg-[#00A86B] hover:bg-[#008B58]" onClick={() => handleCheckIn(e)} data-testid={`checkin-${e.employee_code}`}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Check In
                            </Button>
                          )}
                          {rec?.check_in && !rec?.check_out && (
                            <Button size="sm" variant="outline" className="rounded-none border-zinc-900" onClick={() => handleCheckOut(e)} data-testid={`checkout-${e.employee_code}`}>
                              <LogOut className="w-3.5 h-3.5 mr-1" /> Check Out
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-5 space-y-4">
            <div className="grid-card p-4 flex flex-wrap gap-3 items-center">
              <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="rounded-none w-44" data-testid="att-filter-from" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="rounded-none w-44" data-testid="att-filter-to" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="rounded-none w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All status</SelectItem>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                </SelectContent>
              </Select>
              {(filterFrom || filterTo || filterStatus !== "All") && (
                <Button variant="ghost" className="rounded-none" onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterStatus("All"); }}>
                  <X className="w-4 h-4 mr-1" /> Clear
                </Button>
              )}
            </div>
            <div className="grid-card overflow-hidden">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Code</th><th>Name</th><th>Department</th><th>Shift</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th><th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No attendance records.</td></tr>
                  )}
                  {history.map((r) => (
                    <tr key={r.id + r.date}>
                      <td className="font-mono text-xs">{r.date}</td>
                      <td className="font-mono text-xs text-muted-foreground">{r.employee_code}</td>
                      <td className="font-semibold">{r.employee_name}</td>
                      <td>{r.department}</td>
                      <td><span className="pill pill-info">{r.shift}</span></td>
                      <td className="font-mono text-xs">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                      <td className="font-mono text-xs">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                      <td className="font-mono">{r.hours || "—"}</td>
                      <td>
                        {r.status === "Present" && <span className="pill pill-success">Present</span>}
                        {r.status === "Late" && <span className="pill pill-warn">Late</span>}
                      </td>
                      <td><span className="pill pill-muted">{r.method}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {scanOpen && (
        <ScanModal
          mode={scanMode}
          recognized={recognized}
          scanning={scanning}
          onConfirm={confirmGroup}
          onClose={() => setScanOpen(false)}
          onRemove={(id) => setRecognized((r) => r.filter((x) => x.id !== id))}
        />
      )}
    </>
  );
}

function ScanModal({ mode, recognized, scanning, onConfirm, onClose, onRemove }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" data-testid="scan-modal">
      <div className="bg-white max-w-3xl w-full" style={{ borderRadius: 2 }}>
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="overline">AI Face Recognition · simulated</div>
            <div className="text-xl font-black tracking-tight" style={{ fontFamily: "Chivo" }}>
              {mode === "check_in" ? "Group Check-In" : "Group Check-Out"}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-none" onClick={onClose} data-testid="scan-modal-close">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative bg-zinc-100 aspect-square overflow-hidden" style={{ borderRadius: 2 }}>
            <img
              ref={canvasRef}
              src="https://images.pexels.com/photos/8475204/pexels-photo-8475204.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Faux scanning overlay */}
            {scanning && (
              <>
                <div className="absolute inset-0" style={{
                  background: "linear-gradient(180deg, transparent, rgba(0,168,107,0.25), transparent)",
                  animation: "scanline 1.4s linear infinite",
                }} />
                <div className="absolute top-3 left-3 px-2 py-1 bg-[#09090B] text-[#00A86B] text-[10px] font-mono uppercase tracking-[0.2em]">scanning…</div>
              </>
            )}
            {recognized.map((e, i) => (
              <div
                key={e.id}
                className="absolute border-2 border-[#00A86B]"
                style={{
                  left: `${10 + (i % 3) * 28}%`,
                  top: `${15 + Math.floor(i / 3) * 35}%`,
                  width: "22%",
                  height: "26%",
                  borderRadius: 2,
                  animation: "fadein 200ms ease-out",
                }}
              >
                <div className="absolute -top-5 left-0 bg-[#00A86B] text-white text-[10px] font-mono px-1.5 py-0.5 whitespace-nowrap">
                  {e.name.split(" ")[0]} · {e.employee_code}
                </div>
              </div>
            ))}
            <style>{`
              @keyframes scanline { 0% { transform: translateY(-100%);} 100% {transform:translateY(100%);} }
              @keyframes fadein { from {opacity:0;} to {opacity:1;} }
            `}</style>
          </div>

          <div>
            <div className="overline mb-2">Recognized employees ({recognized.length})</div>
            <div className="space-y-2 max-h-72 overflow-auto">
              {recognized.length === 0 && (
                <div className="text-xs text-muted-foreground font-mono py-6 text-center border border-dashed border-border" style={{ borderRadius: 2 }}>
                  {scanning ? "Detecting faces…" : "No faces detected."}
                </div>
              )}
              {recognized.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2 border border-border" style={{ borderRadius: 2 }}>
                  <div>
                    <div className="font-semibold text-sm">{e.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{e.employee_code} · {e.department}</div>
                  </div>
                  <Button size="icon" variant="ghost" className="rounded-none w-7 h-7" onClick={() => onRemove(e.id)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-2 justify-end">
              <Button variant="outline" className="rounded-none" onClick={onClose} data-testid="scan-cancel">Cancel</Button>
              <Button
                data-testid="scan-confirm"
                disabled={recognized.length === 0 || scanning}
                className="rounded-none bg-[#00A86B] hover:bg-[#008B58]"
                onClick={onConfirm}
              >
                <Camera className="w-4 h-4 mr-1" /> Mark {mode === "check_in" ? "Check-In" : "Check-Out"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeAttendance() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/attendance").then(({ data }) => setItems(data.items)); }, []);
  return (
    <>
      <PageHeader overline="Personal" title="My Attendance" />
      <div className="p-8">
        <div className="grid-card overflow-hidden">
          <table className="erp-table">
            <thead>
              <tr><th>Date</th><th>Shift</th><th>Check-In</th><th>Check-Out</th><th>Hours</th><th>Status</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No attendance yet.</td></tr>}
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.date}</td>
                  <td><span className="pill pill-info">{r.shift}</span></td>
                  <td className="font-mono text-xs">{r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}</td>
                  <td className="font-mono text-xs">{r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}</td>
                  <td className="font-mono">{r.hours || "—"}</td>
                  <td>
                    {r.status === "Present" && <span className="pill pill-success">Present</span>}
                    {r.status === "Late" && <span className="pill pill-warn">Late</span>}
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
