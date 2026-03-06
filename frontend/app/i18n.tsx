"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Lang = "en" | "es";

const translations = {
  // Nav & Auth
  signOut: { en: "Sign Out", es: "Cerrar Sesion" },
  masterList: { en: "Master List", es: "Lista Maestra" },
  events: { en: "Events", es: "Eventos" },
  signIn: { en: "Sign In", es: "Iniciar Sesion" },
  username: { en: "Username", es: "Usuario" },
  password: { en: "Password", es: "Contrasena" },
  invalidCredentials: { en: "Invalid username or password", es: "Usuario o contrasena invalidos" },
  serverError: { en: "Could not connect to server", es: "No se pudo conectar al servidor" },

  // Products page
  productName: { en: "Product Name", es: "Nombre del Producto" },
  productNamePlaceholder: { en: "Product name", es: "Nombre del producto" },
  inspectionLevel: { en: "Inspection Level", es: "Nivel de Inspeccion" },
  aqlLevel: { en: "AQL Level", es: "Nivel AQL" },
  testDetails: { en: "Test Details", es: "Detalles de Prueba" },
  testDetailsPlaceholder: { en: "Describe inspection test details...", es: "Describir detalles de prueba de inspeccion..." },
  addProduct: { en: "Add Product", es: "Agregar Producto" },
  noProducts: { en: "No products yet. Add one above.", es: "No hay productos. Agrega uno arriba." },
  supplier: { en: "Supplier", es: "Proveedor" },
  supplierPlaceholder: { en: "-- Select supplier --", es: "-- Seleccionar proveedor --" },
  suppliers: { en: "Suppliers", es: "Proveedores" },
  addSupplier: { en: "Add Supplier", es: "Agregar Proveedor" },
  supplierNamePlaceholder: { en: "New supplier...", es: "Nuevo proveedor..." },
  noSuppliers: { en: "No suppliers configured.", es: "No hay proveedores configurados." },
  pendingSupplier: { en: "pending", es: "pendiente" },
  dateAdded: { en: "Date Added", es: "Fecha de Alta" },

  // Common actions
  save: { en: "Save", es: "Guardar" },
  cancel: { en: "Cancel", es: "Cancelar" },
  edit: { en: "Edit", es: "Editar" },
  delete: { en: "Delete", es: "Eliminar" },
  remove: { en: "Remove", es: "Eliminar" },

  // Common table headers
  user: { en: "User", es: "Usuario" },
  addedBy: { en: "Added By", es: "Agregado Por" },
  id: { en: "ID", es: "ID" },
  name: { en: "Name", es: "Nombre" },
  product: { en: "Product", es: "Producto" },
  direction: { en: "Direction", es: "Direccion" },
  lotSize: { en: "Lot Size", es: "Tamano de Lote" },
  date: { en: "Date", es: "Fecha" },

  // Events page - Schedule
  scheduleInspection: { en: "Schedule Inspection", es: "Programar Inspeccion" },
  incoming: { en: "Incoming", es: "Entrante" },
  outgoing: { en: "Outgoing", es: "Saliente" },
  estimatedDate: { en: "Estimated Date", es: "Fecha Estimada" },
  schedule: { en: "Schedule", es: "Programar" },
  addProductsFirst: { en: "-- Add products first --", es: "-- Agrega productos primero --" },

  // Events page - Pending
  pendingInspections: { en: "Pending Inspections", es: "Inspecciones Pendientes" },
  suggestedQty: { en: "Suggested Qty", es: "Cant. Sugerida" },
  estDate: { en: "Est. Date", es: "Fecha Est." },
  overdue: { en: "OVERDUE", es: "VENCIDA" },
  inspect: { en: "Inspect", es: "Inspeccionar" },

  // Events page - Complete Inspection
  completeInspectionTitle: { en: "Complete Inspection", es: "Completar Inspeccion" },
  suggestedInspectionQty: { en: "Suggested Inspection Qty", es: "Cant. de Inspeccion Sugerida" },
  qtyInspected: { en: "Qty Inspected", es: "Cant. Inspeccionada" },
  qtyNonConforming: { en: "Qty Non-Conforming", es: "Cant. No Conforme" },
  dateInspected: { en: "Date Inspected", es: "Fecha de Inspeccion" },
  codeLetter: { en: "Code Letter", es: "Letra de Codigo" },
  acceptReject: { en: "Accept / Reject", es: "Aceptar / Rechazar" },
  resultPreview: { en: "Result Preview", es: "Vista Previa del Resultado" },
  completeInspection: { en: "Complete Inspection", es: "Completar Inspeccion" },

  // Events page - Completed
  completedEvents: { en: "Completed Events", es: "Eventos Completados" },
  passedEvents: { en: "Passed Events", es: "Eventos Aprobados" },
  noPassedEvents: { en: "No passed events yet.", es: "No hay eventos aprobados." },
  exportPdf: { en: "Export PDF", es: "Exportar PDF" },
  noEvents: { en: "No events recorded yet.", es: "No hay eventos registrados." },
  sample: { en: "Sample", es: "Muestra" },
  inspected: { en: "Inspected", es: "Inspeccionados" },
  nonConf: { en: "Non-Conf.", es: "No Conf." },
  passFail: { en: "Pass/Fail", es: "Pasa/Falla" },
  pass: { en: "Pass", es: "Pasa" },
  fail: { en: "Fail", es: "Falla" },

  // Company
  company: { en: "Company", es: "Empresa" },
  all: { en: "All", es: "Todas" },

  // Settings & User Management
  settings: { en: "Settings", es: "Configuracion" },
  users: { en: "Users", es: "Usuarios" },
  addUser: { en: "Add User", es: "Agregar Usuario" },
  companyAccess: { en: "Company Access", es: "Acceso a Empresa" },
  manageProducts: { en: "Add/Delete Products", es: "Agregar/Eliminar Productos" },
  editPending: { en: "Edit Pending", es: "Editar Pendientes" },
  deletePending: { en: "Delete Pending", es: "Eliminar Pendientes" },
  editEvents: { en: "Edit Events", es: "Editar Eventos" },
  deleteEvents: { en: "Delete Events", es: "Eliminar Eventos" },
  admin: { en: "Admin", es: "Admin" },
  yes: { en: "Yes", es: "Si" },
  no: { en: "No", es: "No" },
  noUsers: { en: "No users yet.", es: "No hay usuarios." },
  permissions: { en: "Permissions", es: "Permisos" },
  setSuggestedAction: { en: "Set Suggested Action", es: "Asignar Accion Sugerida" },

  // Suggested Actions
  suggestedActions: { en: "Suggested Actions", es: "Acciones Sugeridas" },
  suggestedAction: { en: "Suggested Action", es: "Accion Sugerida" },
  addAction: { en: "Add Action", es: "Agregar Accion" },
  actionPlaceholder: { en: "New action...", es: "Nueva accion..." },
  noActions: { en: "No suggested actions configured.", es: "No hay acciones sugeridas configuradas." },
  selectAction: { en: "-- Select --", es: "-- Seleccionar --" },
  none: { en: "None", es: "Ninguna" },

  // Failed Events & Addressed Fails
  failedEvents: { en: "Failed Events", es: "Eventos Fallidos" },
  awaitingFix: { en: "Awaiting Fix", es: "Pendiente de Correccion" },
  addressedFails: { en: "Addressed Fails", es: "Fallos Atendidos" },
  markAddressed: { en: "Mark Addressed", es: "Marcar Atendido" },
  unaddress: { en: "Unaddress", es: "Desmarcar" },
  addressedDate: { en: "Addressed Date", es: "Fecha Atendido" },
  noFailedEvents: { en: "No failed events pending action.", es: "No hay eventos fallidos pendientes." },
  noAddressedFails: { en: "No addressed fails yet.", es: "No hay fallos atendidos." },
  canMarkAddressed: { en: "Mark Addressed", es: "Marcar Atendido" },
  canEditAddressed: { en: "Edit Addressed", es: "Editar Atendidos" },
  canDeleteAddressed: { en: "Delete Addressed", es: "Eliminar Atendidos" },

  // Pagination
  page: { en: "Page", es: "Pagina" },
  of: { en: "of", es: "de" },
  prev: { en: "Previous", es: "Anterior" },
  next: { en: "Next", es: "Siguiente" },
  perPage: { en: "per page", es: "por pagina" },
  showing: { en: "Showing", es: "Mostrando" },
} as const;

export type TKey = keyof typeof translations;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "en",
  setLang: () => {},
  t: (key) => translations[key].en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "es") setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("lang", l);
  }

  function t(key: TKey): string {
    return translations[key][lang];
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

// --- Company Context ---

export type Company = "All" | "VBC" | "VBP";

interface CompanyContextType {
  company: Company;
  setCompany: (c: Company) => void;
}

const CompanyContext = createContext<CompanyContextType>({
  company: "All",
  setCompany: () => {},
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompanyState] = useState<Company>("All");

  useEffect(() => {
    const saved = localStorage.getItem("company") as Company | null;
    if (saved === "All" || saved === "VBC" || saved === "VBP") setCompanyState(saved);
  }, []);

  function setCompany(c: Company) {
    setCompanyState(c);
    localStorage.setItem("company", c);
  }

  return (
    <CompanyContext.Provider value={{ company, setCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}

// --- Auth Context ---

export interface UserPermissions {
  username: string;
  is_admin: boolean;
  company_access: string;
  can_manage_products: boolean;
  can_edit_pending: boolean;
  can_delete_pending: boolean;
  can_edit_events: boolean;
  can_delete_events: boolean;
  can_set_suggested_action: boolean;
  can_mark_addressed: boolean;
  can_edit_addressed: boolean;
  can_delete_addressed: boolean;
}

const defaultPerms: UserPermissions = {
  username: "",
  is_admin: false,
  company_access: "All",
  can_manage_products: false,
  can_edit_pending: false,
  can_delete_pending: false,
  can_edit_events: false,
  can_delete_events: false,
  can_set_suggested_action: false,
  can_mark_addressed: false,
  can_edit_addressed: false,
  can_delete_addressed: false,
};

interface AuthContextType {
  perms: UserPermissions;
  setPerms: (p: UserPermissions) => void;
}

const AuthContext = createContext<AuthContextType>({
  perms: defaultPerms,
  setPerms: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [perms, setPermsState] = useState<UserPermissions>(defaultPerms);

  useEffect(() => {
    const saved = localStorage.getItem("userPerms");
    if (saved) {
      try { setPermsState(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  function setPerms(p: UserPermissions) {
    setPermsState(p);
    localStorage.setItem("userPerms", JSON.stringify(p));
  }

  return (
    <AuthContext.Provider value={{ perms, setPerms }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
