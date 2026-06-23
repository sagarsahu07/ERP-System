import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard, Users, ScanFace, CalendarClock, FileText,
  Wallet, BarChart3, LogOut, Building2, ClipboardList,
} from "lucide-react";

const adminNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/attendance", label: "Attendance", icon: ScanFace },
  { to: "/leaves", label: "Leaves", icon: ClipboardList },
  { to: "/shifts", label: "Shifts", icon: CalendarClock },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/reports", label: "Reports", icon: BarChart3 },
];

const empNav = [
  { to: "/", label: "My Dashboard", icon: LayoutDashboard, end: true },
  { to: "/attendance", label: "My Attendance", icon: ScanFace },
  { to: "/leaves", label: "My Leaves", icon: ClipboardList },
  { to: "/payroll", label: "My Payslips", icon: Wallet },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = user?.role === "admin" ? adminNav : empNav;

  return (
    <div className="min-h-screen flex" style={{ background: "#FAFAFA" }}>
      <aside
        data-testid="erp-sidebar"
        className="w-64 shrink-0 bg-white border-r border-border flex flex-col"
      >
        <div className="px-5 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 bg-[#00A86B] text-white flex items-center justify-center font-black text-lg" style={{ borderRadius: 2 }}>
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-black tracking-tight text-[15px]" style={{ fontFamily: "Chivo" }}>RETAIL ERP</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">v1.0 / dmart</div>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-2 pb-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">Signed in</div>
            <div className="text-sm font-semibold mt-1 truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
          <button
            data-testid="logout-button"
            onClick={async () => { await logout(); nav("/login"); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#52525B] hover:bg-[#F4F4F5] hover:text-[#09090B] transition-colors"
            style={{ borderRadius: 2 }}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ overline, title, action }) {
  return (
    <div className="border-b border-border bg-white">
      <div className="px-8 py-6 flex items-end justify-between gap-6">
        <div>
          {overline && <div className="overline mb-2">{overline}</div>}
          <h1 className="text-[28px] sm:text-[34px] font-black tracking-tight leading-none" style={{ fontFamily: "Chivo" }}>{title}</h1>
        </div>
        {action}
      </div>
    </div>
  );
}
