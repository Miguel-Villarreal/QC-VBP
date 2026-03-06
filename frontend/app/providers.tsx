"use client";

import { I18nProvider, CompanyProvider, AuthProvider } from "./i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <CompanyProvider>{children}</CompanyProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
