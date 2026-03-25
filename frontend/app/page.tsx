"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useAuth, useCompany, Company } from "./i18n";
import { API_BASE } from "./api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { t } = useI18n();
  const { setPerms } = useAuth();
  const { setCompany } = useCompany();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError(t("invalidCredentials"));
        return;
      }
      const data = await res.json();
      localStorage.setItem("token", data.token);
      setPerms({
        username: data.username,
        is_admin: data.is_admin,
        company_access: data.company_access,
        can_manage_products: data.can_manage_products,
        can_edit_pending: data.can_edit_pending,
        can_delete_pending: data.can_delete_pending,
        can_edit_events: data.can_edit_events,
        can_delete_events: data.can_delete_events,
        can_set_suggested_action: data.can_set_suggested_action,
        can_mark_addressed: data.can_mark_addressed,
        can_edit_addressed: data.can_edit_addressed,
        can_delete_addressed: data.can_delete_addressed,
        can_assign: data.can_assign,
      });
      setCompany(data.company_access as Company);
      router.push("/dashboard");
    } catch {
      setError(t("serverError"));
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form
        onSubmit={handleLogin}
        className="bg-white shadow rounded-lg p-8 w-full max-w-sm space-y-4"
      >
        <h1 className="text-2xl font-bold text-center">QC Inspector</h1>
        <div>
          <label className="block text-sm font-medium mb-1">{t("username")}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("password")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700"
        >
          {t("signIn")}
        </button>
      </form>
    </div>
  );
}
