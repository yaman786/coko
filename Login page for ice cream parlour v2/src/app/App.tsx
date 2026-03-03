import { useState } from "react";
import { LoginForm } from "./components/login-form";
import { Dashboard } from "./components/dashboard";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState("");

  const handleLogin = (
    email: string,
    password: string,
    role: string,
  ) => {
    // Mock authentication - in production, this would validate against a backend
    console.log("Login attempt:", { email, role });
    setUserRole(role);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole("");
  };

  if (isLoggedIn) {
    return <Dashboard userRole={userRole} onLogout={handleLogout} />;
  }

  return <LoginForm onLogin={handleLogin} />;
}