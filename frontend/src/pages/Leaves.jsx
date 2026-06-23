import { useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { PageHeader } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const TYPES = ["Casual", "Sick", "Earned", "Unpaid"];

export default function Leaves() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [statusF, setStatusF] = useState("All");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "Casual", start_date: "", end_date: "", reason: "" });

  const load = useCallback(async () => {
    const params = {};
    if (statusF !== "All") params.status = statusF;
    const { data } = await api.get("/leaves", { params });
    setItems(data.items);
  }, [statusF]);
  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    try {
      await api.post("/leaves", form);
      toast.success("Leave application submitted");
      setOpen(false);
      setForm({ leave_type: "Casual", start_date: "", end_date: "", reason: "" });
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const decide = async (id, status) => {
    try {
      await api.post(`/leaves/${id}/decision`, { status });
      toast.success(`Leave ${status.toLowerCase()}`);
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  return (
    <>
      <PageHeader
        overline={isAdmin ? "HR" : "Personal"}
        title={isAdmin ? "Leave Requests" : "My Leaves"}
        action={!isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="apply-leave-btn" className="rounded-none bg-[#00A86B] hover:bg-[#008B58]">
                <Plus className="w-4 h-4 mr-1" /> Apply Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-none max-w-md">
              <DialogHeader>
                <DialogTitle className="font-black tracking-tight text-2xl" style={{ fontFamily: "Chivo" }}>Apply for leave</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="overline block mb-2">Leave type</label>
                  <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                    <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="overline block mb-2">From</label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="rounded-none" data-testid="leave-start" />
                  </div>
                  <div>
                    <label className="overline block mb-2">To</label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="rounded-none" data-testid="leave-end" />
                  </div>
                </div>
                <div>
                  <label className="overline block mb-2">Reason</label>
                  <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="rounded-none" rows={3} data-testid="leave-reason" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" className="rounded-none" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button className="rounded-none bg-[#00A86B] hover:bg-[#008B58]" onClick={apply} data-testid="leave-submit">Submit</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      />
      <div className="p-8 space-y-5">
        <div className="grid-card p-4 flex flex-wrap items-center gap-3">
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="rounded-none w-40" data-testid="leave-filter-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid-card overflow-hidden">
          <table className="erp-table" data-testid="leaves-table">
            <thead>
              <tr>
                {isAdmin && <th>Employee</th>}
                <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>
                {isAdmin && <th className="text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={isAdmin ? 8 : 6} className="text-center py-8 text-muted-foreground">No leave requests.</td></tr>}
              {items.map((l) => (
                <tr key={l.id}>
                  {isAdmin && (
                    <td>
                      <div className="font-semibold">{l.employee_name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{l.employee_code}</div>
                    </td>
                  )}
                  <td><span className="pill pill-info">{l.leave_type}</span></td>
                  <td className="font-mono text-xs">{l.start_date}</td>
                  <td className="font-mono text-xs">{l.end_date}</td>
                  <td className="font-mono">{l.days}</td>
                  <td className="max-w-xs truncate" title={l.reason}>{l.reason || "—"}</td>
                  <td>
                    {l.status === "Pending" && <span className="pill pill-warn">Pending</span>}
                    {l.status === "Approved" && <span className="pill pill-success">Approved</span>}
                    {l.status === "Rejected" && <span className="pill pill-danger">Rejected</span>}
                  </td>
                  {isAdmin && (
                    <td className="text-right">
                      {l.status === "Pending" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" className="rounded-none bg-[#00A86B] hover:bg-[#008B58]" onClick={() => decide(l.id, "Approved")} data-testid={`leave-approve-${l.id}`}>
                            <Check className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-none border-[#9F1239] text-[#9F1239]" onClick={() => decide(l.id, "Rejected")} data-testid={`leave-reject-${l.id}`}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
