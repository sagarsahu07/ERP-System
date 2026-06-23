import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Navigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, ArrowRight, ShieldCheck } from "lucide-react";

export default function Login() {
  const { login, user, error } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@dmart.co");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  if (user && user !== false) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await login(email, password);
    setBusy(false);
    if (ok) nav("/");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img
          src="https://images.unsplash.com/photo-1604719312566-8912e9227c6a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1600"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(9,9,11,0.75) 0%, rgba(0,168,107,0.55) 100%)" }} />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white text-[#00A86B] flex items-center justify-center" style={{ borderRadius: 2 }}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black tracking-tight">RETAIL ERP</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-80">workforce control</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] opacity-80 mb-3">Operations Console</div>
            <h2 className="text-5xl font-black tracking-tighter leading-[0.95]" style={{ fontFamily: "Chivo" }}>
              Run every store<br />like clockwork.
            </h2>
            <p className="mt-5 max-w-md text-sm opacity-90 leading-relaxed">
              Group face-recognition attendance, shift control, leaves, payroll and analytics — one workspace for every aisle, register and stockroom.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] opacity-80">
            <ShieldCheck className="w-4 h-4" /> secure · audited · role-based
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12 bg-white">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="login-form">
          <div className="overline mb-3">Sign in</div>
          <h1 className="text-4xl font-black tracking-tighter leading-none" style={{ fontFamily: "Chivo" }}>
            Welcome back.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Use your admin or employee account to access the workspace.
          </p>

          <div className="mt-8 space-y-4">
            <div>
              <label className="overline block mb-2">Email</label>
              <Input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-none border-zinc-300 focus-visible:ring-1 focus-visible:ring-[#00A86B]"
              />
            </div>
            <div>
              <label className="overline block mb-2">Password</label>
              <Input
                data-testid="login-password-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-none border-zinc-300 focus-visible:ring-1 focus-visible:ring-[#00A86B]"
              />
            </div>

            {error && (
              <div data-testid="login-error" className="text-sm text-[#9F1239] font-medium border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2" style={{ borderRadius: 2 }}>
                {error}
              </div>
            )}

            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={busy}
              className="w-full rounded-none h-11 bg-[#00A86B] hover:bg-[#008B58] text-white font-semibold tracking-wide"
            >
              {busy ? "Signing in…" : <>Sign in <ArrowRight className="w-4 h-4 ml-1" /></>}
            </Button>
          </div>

          <div className="mt-10 border-t border-border pt-6">
            <div className="overline mb-3">Demo credentials</div>
            <div className="text-xs font-mono space-y-1 text-muted-foreground">
              <div><span className="text-foreground font-semibold">admin@dmart.co</span> / admin123</div>
              <div><span className="text-foreground font-semibold">priya@dmart.co</span> / employee123 (employee)</div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
