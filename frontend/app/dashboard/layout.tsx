"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useI18n, Lang, useCompany, Company, useAuth } from "../i18n";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useI18n();
  const { company, setCompany } = useCompany();
  const { perms } = useAuth();

  const navItems = [
    { href: "/dashboard/products", label: t("masterList") },
    { href: "/dashboard/events", label: t("events") },
    ...(perms.is_admin ? [{ href: "/dashboard/users", label: t("settings") }] : []),
  ];

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      router.push("/");
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userPerms");
    router.push("/");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white shadow px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            {(company === "All" || company === "VBC") && (
              <img src="/logo_VBC.png" alt="VBC" className="h-9 object-contain" />
            )}
            {(company === "All" || company === "VBP") && (
              <img src="/logo_VBP.jpg" alt="VBP" className="h-9 object-contain" />
            )}
          </div>
          <span className="font-bold text-lg">QC Inspector</span>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium px-3 py-1 rounded ${
                pathname === item.href
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {perms.company_access === "All" ? (
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value as Company)}
              className="text-sm border rounded px-2 py-1 bg-white text-gray-600 font-medium"
            >
              <option value="All">{t("all")}</option>
              <option value="VBC">VBC</option>
              <option value="VBP">VBP</option>
            </select>
          ) : (
            <span className="text-sm font-medium text-gray-600">{perms.company_access}</span>
          )}
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="text-sm border rounded px-2 py-1 bg-white text-gray-600"
          >
            <option value="en">English</option>
            <option value="es">Espanol</option>
          </select>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            {t("signOut")}
          </button>
        </div>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
