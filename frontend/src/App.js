import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Employees from "@/pages/Employees";
import Attendance from "@/pages/Attendance";
import Leaves from "@/pages/Leaves";
import Shifts from "@/pages/Shifts";
import Payroll from "@/pages/Payroll";
import Reports from "@/pages/Reports";
import MyDashboard from "@/pages/MyDashboard";
import { Toaster } from "sonner";

function HomeRouter() {
  const { user } = useAuth();
  if (!user) return null;
  return user.role === "admin" ? <Dashboard /> : <MyDashboard />;
}

function ProtectedShell({ children, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { borderRadius: 2, fontFamily: "IBM Plex Sans" } }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedShell><HomeRouter /></ProtectedShell>} />
          <Route path="/employees" element={<ProtectedShell roles={["admin"]}><Employees /></ProtectedShell>} />
          <Route path="/attendance" element={<ProtectedShell><Attendance /></ProtectedShell>} />
          <Route path="/leaves" element={<ProtectedShell><Leaves /></ProtectedShell>} />
          <Route path="/shifts" element={<ProtectedShell roles={["admin"]}><Shifts /></ProtectedShell>} />
          <Route path="/payroll" element={<ProtectedShell><Payroll /></ProtectedShell>} />
          <Route path="/reports" element={<ProtectedShell roles={["admin"]}><Reports /></ProtectedShell>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
