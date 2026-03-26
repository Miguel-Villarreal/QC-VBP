"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n, useAuth } from "../../i18n";
import { apiFetch } from "../../api";

interface User {
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
  can_assign: boolean;
  can_manage_users: boolean;
}

export default function SettingsPage() {
  const { t } = useI18n();
  const { perms } = useAuth();
  const [userList, setUserList] = useState<User[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newCompanyAccess, setNewCompanyAccess] = useState("All");
  const [newCanManageProducts, setNewCanManageProducts] = useState(true);
  const [newCanEditPending, setNewCanEditPending] = useState(true);
  const [newCanDeletePending, setNewCanDeletePending] = useState(true);
  const [newCanEditEvents, setNewCanEditEvents] = useState(true);
  const [newCanDeleteEvents, setNewCanDeleteEvents] = useState(true);
  const [newCanSetSuggestedAction, setNewCanSetSuggestedAction] = useState(true);
  const [newCanMarkAddressed, setNewCanMarkAddressed] = useState(true);
  const [newCanEditAddressed, setNewCanEditAddressed] = useState(true);
  const [newCanDeleteAddressed, setNewCanDeleteAddressed] = useState(true);
  const [newCanAssign, setNewCanAssign] = useState(true);
  const [newCanManageUsers, setNewCanManageUsers] = useState(false);

  // Suggested Actions state
  const [actionsList, setActionsList] = useState<string[]>([]);
  const [newAction, setNewAction] = useState("");

  // Suppliers state
  const [suppliersList, setSuppliersList] = useState<string[]>([]);
  const [newSupplier, setNewSupplier] = useState("");

  const loadUsers = useCallback(async () => {
    const res = await apiFetch(`/api/users`);
    setUserList(await res.json());
  }, []);

  const loadActions = useCallback(async () => {
    const res = await apiFetch(`/api/suggested-actions`);
    setActionsList(await res.json());
  }, []);

  const loadSuppliers = useCallback(async () => {
    const res = await apiFetch(`/api/suppliers`);
    setSuppliersList(await res.json());
  }, []);

  useEffect(() => {
    loadUsers();
    loadActions();
    loadSuppliers();
  }, [loadUsers, loadActions, loadSuppliers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    try {
      const res = await apiFetch(`/api/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword.trim(),
          company_access: newCompanyAccess,
          can_manage_products: newCanManageProducts,
          can_edit_pending: newCanEditPending,
          can_delete_pending: newCanDeletePending,
          can_edit_events: newCanEditEvents,
          can_delete_events: newCanDeleteEvents,
          can_set_suggested_action: newCanSetSuggestedAction,
          can_mark_addressed: newCanMarkAddressed,
          can_edit_addressed: newCanEditAddressed,
          can_delete_addressed: newCanDeleteAddressed,
          can_assign: newCanAssign,
          can_manage_users: newCanManageUsers,
        }),
      });
      if (!res.ok) { alert(t("errorSaving")); return; }
      setNewUsername("");
      setNewPassword("");
      setNewCompanyAccess("All");
      setNewCanManageProducts(true);
      setNewCanEditPending(true);
      setNewCanDeletePending(true);
      setNewCanEditEvents(true);
      setNewCanDeleteEvents(true);
      setNewCanSetSuggestedAction(true);
      setNewCanMarkAddressed(true);
      setNewCanEditAddressed(true);
      setNewCanDeleteAddressed(true);
      setNewCanManageUsers(false);
      loadUsers();
    } catch { alert(t("errorSaving")); }
  }

  // Edit user state
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editCompanyAccess, setEditCompanyAccess] = useState("All");
  const [editCanManageProducts, setEditCanManageProducts] = useState(true);
  const [editCanEditPending, setEditCanEditPending] = useState(true);
  const [editCanDeletePending, setEditCanDeletePending] = useState(true);
  const [editCanEditEvents, setEditCanEditEvents] = useState(true);
  const [editCanDeleteEvents, setEditCanDeleteEvents] = useState(true);
  const [editCanSetSuggestedAction, setEditCanSetSuggestedAction] = useState(true);
  const [editCanMarkAddressed, setEditCanMarkAddressed] = useState(true);
  const [editCanEditAddressed, setEditCanEditAddressed] = useState(true);
  const [editCanDeleteAddressed, setEditCanDeleteAddressed] = useState(true);
  const [editCanAssign, setEditCanAssign] = useState(true);
  const [editCanManageUsers, setEditCanManageUsers] = useState(false);

  function startEdit(u: User) {
    setEditingUser(u.username);
    setEditUsername(u.username);
    setEditPassword("");
    setEditCompanyAccess(u.company_access);
    setEditCanManageProducts(u.can_manage_products);
    setEditCanEditPending(u.can_edit_pending);
    setEditCanDeletePending(u.can_delete_pending);
    setEditCanEditEvents(u.can_edit_events);
    setEditCanDeleteEvents(u.can_delete_events);
    setEditCanSetSuggestedAction(u.can_set_suggested_action);
    setEditCanMarkAddressed(u.can_mark_addressed);
    setEditCanEditAddressed(u.can_edit_addressed);
    setEditCanDeleteAddressed(u.can_delete_addressed);
    setEditCanAssign(u.can_assign);
    setEditCanManageUsers(u.can_manage_users);
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    const body: Record<string, unknown> = {
      new_username: editUsername.trim() !== editingUser ? editUsername.trim() : undefined,
      new_password: editPassword.trim() || undefined,
      company_access: editCompanyAccess,
      can_manage_products: editCanManageProducts,
      can_edit_pending: editCanEditPending,
      can_delete_pending: editCanDeletePending,
      can_edit_events: editCanEditEvents,
      can_delete_events: editCanDeleteEvents,
      can_set_suggested_action: editCanSetSuggestedAction,
      can_mark_addressed: editCanMarkAddressed,
      can_edit_addressed: editCanEditAddressed,
      can_delete_addressed: editCanDeleteAddressed,
      can_assign: editCanAssign,
      can_manage_users: editCanManageUsers,
    };
    try {
      const res = await apiFetch(`/api/users/${editingUser}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { alert(t("errorSaving")); return; }
      setEditingUser(null);
      loadUsers();
    } catch { alert(t("errorSaving")); }
  }

  async function handleDelete(username: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await apiFetch(`/api/users/${username}`, { method: "DELETE" });
      if (!res.ok) { alert(t("errorDeleting")); return; }
      loadUsers();
    } catch { alert(t("errorDeleting")); }
  }

  async function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    if (!newAction.trim()) return;
    try {
      const res = await apiFetch(`/api/suggested-actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: newAction.trim() }),
      });
      if (!res.ok) { alert(t("errorSaving")); return; }
      setNewAction("");
      loadActions();
    } catch { alert(t("errorSaving")); }
  }

  async function handleDeleteAction(index: number) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await apiFetch(`/api/suggested-actions/${index}`, { method: "DELETE" });
      if (!res.ok) { alert(t("errorDeleting")); return; }
      loadActions();
    } catch { alert(t("errorDeleting")); }
  }

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!newSupplier.trim()) return;
    try {
      const res = await apiFetch(`/api/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSupplier.trim() }),
      });
      if (!res.ok) { alert(t("errorSaving")); return; }
      setNewSupplier("");
      loadSuppliers();
    } catch { alert(t("errorSaving")); }
  }

  async function handleDeleteSupplier(index: number) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      const res = await apiFetch(`/api/suppliers/${index}`, { method: "DELETE" });
      if (!res.ok) { alert(t("errorDeleting")); return; }
      loadSuppliers();
    } catch { alert(t("errorDeleting")); }
  }

  if (!perms.is_admin && !perms.can_manage_users) {
    return <p className="text-gray-500">Access denied.</p>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h2 className="text-xl font-bold">{t("settings")}</h2>

      {/* --- Suggested Actions Management --- */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">{t("suggestedActions")}</h3>
        <form onSubmit={handleAddAction} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newAction}
            onChange={(e) => setNewAction(e.target.value)}
            placeholder={t("actionPlaceholder")}
            className="flex-1 border rounded px-3 py-2"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
          >
            {t("addAction")}
          </button>
        </form>
        {actionsList.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noActions")}</p>
        ) : (
          <ul className="space-y-2">
            {actionsList.map((action, idx) => (
              <li key={idx} className="flex items-center justify-between border rounded px-3 py-2">
                <span className="text-sm">{action}</span>
                <button
                  onClick={() => handleDeleteAction(idx)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- Suppliers Management --- */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">{t("suppliers")}</h3>
        <form onSubmit={handleAddSupplier} className="flex gap-2 mb-4">
          <input
            type="text"
            value={newSupplier}
            onChange={(e) => setNewSupplier(e.target.value)}
            placeholder={t("supplierNamePlaceholder")}
            className="flex-1 border rounded px-3 py-2"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
          >
            {t("addSupplier")}
          </button>
        </form>
        {suppliersList.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("noSuppliers")}</p>
        ) : (
          <ul className="space-y-2">
            {suppliersList.map((supplier, idx) => (
              <li key={idx} className="flex items-center justify-between border rounded px-3 py-2">
                <span className="text-sm">{supplier}</span>
                <button
                  onClick={() => handleDeleteSupplier(idx)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* --- User Management --- */}
      <div>
        <h3 className="text-lg font-semibold mb-4">{t("users")}</h3>

        <form onSubmit={handleAdd} className="bg-white shadow rounded-lg p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("username")}</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("password")}</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t("companyAccess")}</label>
            <select
              value={newCompanyAccess}
              onChange={(e) => setNewCompanyAccess(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="All">{t("all")}</option>
              <option value="VBC">VBC</option>
              <option value="VBP">VBP</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanManageProducts}
                onChange={(e) => setNewCanManageProducts(e.target.checked)}
              />
              {t("manageProducts")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanEditPending}
                onChange={(e) => setNewCanEditPending(e.target.checked)}
              />
              {t("editPending")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanDeletePending}
                onChange={(e) => setNewCanDeletePending(e.target.checked)}
              />
              {t("deletePending")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanEditEvents}
                onChange={(e) => setNewCanEditEvents(e.target.checked)}
              />
              {t("editEvents")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanDeleteEvents}
                onChange={(e) => setNewCanDeleteEvents(e.target.checked)}
              />
              {t("deleteEvents")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanSetSuggestedAction}
                onChange={(e) => setNewCanSetSuggestedAction(e.target.checked)}
              />
              {t("setSuggestedAction")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanMarkAddressed}
                onChange={(e) => setNewCanMarkAddressed(e.target.checked)}
              />
              {t("canMarkAddressed")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanEditAddressed}
                onChange={(e) => setNewCanEditAddressed(e.target.checked)}
              />
              {t("canEditAddressed")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanDeleteAddressed}
                onChange={(e) => setNewCanDeleteAddressed(e.target.checked)}
              />
              {t("canDeleteAddressed")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanAssign}
                onChange={(e) => setNewCanAssign(e.target.checked)}
              />
              {t("canAssign")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newCanManageUsers}
                onChange={(e) => setNewCanManageUsers(e.target.checked)}
              />
              {t("canManageUsers")}
            </label>
          </div>

          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
          >
            {t("addUser")}
          </button>
        </form>

        {userList.length === 0 ? (
          <p className="text-gray-500">{t("noUsers")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="text-left px-3 py-2">{t("username")}</th>
                  <th className="text-left px-3 py-2">{t("companyAccess")}</th>
                  <th className="text-left px-3 py-2">{t("manageProducts")}</th>
                  <th className="text-left px-3 py-2">{t("editPending")}</th>
                  <th className="text-left px-3 py-2">{t("deletePending")}</th>
                  <th className="text-left px-3 py-2">{t("editEvents")}</th>
                  <th className="text-left px-3 py-2">{t("deleteEvents")}</th>
                  <th className="text-left px-3 py-2">{t("setSuggestedAction")}</th>
                  <th className="text-left px-3 py-2">{t("canMarkAddressed")}</th>
                  <th className="text-left px-3 py-2">{t("canEditAddressed")}</th>
                  <th className="text-left px-3 py-2">{t("canDeleteAddressed")}</th>
                  <th className="text-left px-3 py-2">{t("canAssign")}</th>
                  <th className="text-left px-3 py-2">{t("canManageUsers")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {userList.map((u) => (
                  editingUser === u.username ? (
                    <tr key={u.username} className="border-b bg-blue-50">
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          className="border rounded px-2 py-1 w-full text-sm"
                        />
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder={t("newPasswordPlaceholder")}
                          className="border rounded px-2 py-1 w-full text-sm mt-1"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editCompanyAccess}
                          onChange={(e) => setEditCompanyAccess(e.target.value)}
                          className="border rounded px-2 py-1 text-sm"
                        >
                          <option value="All">{t("all")}</option>
                          <option value="VBC">VBC</option>
                          <option value="VBP">VBP</option>
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanManageProducts} onChange={(e) => setEditCanManageProducts(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanEditPending} onChange={(e) => setEditCanEditPending(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanDeletePending} onChange={(e) => setEditCanDeletePending(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanEditEvents} onChange={(e) => setEditCanEditEvents(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanDeleteEvents} onChange={(e) => setEditCanDeleteEvents(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanSetSuggestedAction} onChange={(e) => setEditCanSetSuggestedAction(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanMarkAddressed} onChange={(e) => setEditCanMarkAddressed(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanEditAddressed} onChange={(e) => setEditCanEditAddressed(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanDeleteAddressed} onChange={(e) => setEditCanDeleteAddressed(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanAssign} onChange={(e) => setEditCanAssign(e.target.checked)} /></td>
                      <td className="px-3 py-2"><input type="checkbox" checked={editCanManageUsers} onChange={(e) => setEditCanManageUsers(e.target.checked)} /></td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-800 text-sm">{t("save")}</button>
                        <button onClick={() => setEditingUser(null)} className="text-gray-600 hover:text-gray-800 text-sm">{t("cancel")}</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={u.username} className="border-b">
                      <td className="px-3 py-2">
                        {u.username}
                        {u.is_admin && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            {t("admin")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{u.company_access}</td>
                      <td className="px-3 py-2">{u.can_manage_products ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_edit_pending ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_delete_pending ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_edit_events ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_delete_events ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_set_suggested_action ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_mark_addressed ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_edit_addressed ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_delete_addressed ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_assign ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2">{u.can_manage_users ? t("yes") : t("no")}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button onClick={() => startEdit(u)} className="text-blue-600 hover:text-blue-800 text-sm">{t("edit")}</button>
                        {!u.is_admin && (
                          <button
                            onClick={() => handleDelete(u.username)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            {t("delete")}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
