"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n, useCompany, useAuth } from "../../i18n";
import { apiFetch, apiUrl } from "../../api";

interface Product {
  id: number;
  name: string;
  inspection_level: string;
  aql_level: string;
  test_details: string;
  supplier: string;
  file: string;
  created_by: string;
  created_at: string;
}

export default function ProductsPage() {
  const { t } = useI18n();
  const { company } = useCompany();
  const { perms } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [aqlLevels, setAqlLevels] = useState<string[]>([]);
  const [inspectionLevels, setInspectionLevels] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newInspLevel, setNewInspLevel] = useState("");
  const [newAql, setNewAql] = useState("");
  const [newTestDetails, setNewTestDetails] = useState("");
  const [newSupplier, setNewSupplier] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editInspLevel, setEditInspLevel] = useState("");
  const [editAql, setEditAql] = useState("");
  const [editTestDetails, setEditTestDetails] = useState("");
  const [editSupplier, setEditSupplier] = useState("");

  // File upload and preview state
  const [newFile, setNewFile] = useState<File | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    const res = await apiFetch(`/api/products?company=${company}`);
    setProducts(await res.json());
  }, [company]);

  useEffect(() => {
    loadProducts();
    Promise.all([
      apiFetch(`/api/aql-levels`).then((r) => r.json()),
      apiFetch(`/api/inspection-levels`).then((r) => r.json()),
      apiFetch(`/api/suppliers`).then((r) => r.json()).catch(() => []),
    ]).then(([aqls, insps, supps]) => {
      setAqlLevels(aqls);
      setNewAql(aqls[0] || "");
      setInspectionLevels(insps);
      setNewInspLevel(insps[1] || insps[0] || ""); // default to "II"
      setSuppliers(Array.isArray(supps) ? supps : []);
    });
  }, [loadProducts]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await apiFetch(`/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        inspection_level: newInspLevel,
        aql_level: newAql,
        test_details: newTestDetails,
        supplier: newSupplier,
        company,
        created_by: perms.username,
      }),
    });
    const created = await res.json();
    if (newFile) {
      const fd = new FormData();
      fd.append("file", newFile);
      await apiFetch(`/api/products/${created.id}/file`, { method: "POST", body: fd });
      setNewFile(null);
    }
    setNewName("");
    setNewTestDetails("");
    setNewSupplier("");
    loadProducts();
  }

  async function handleDelete(id: number) {
    await apiFetch(`/api/products/${id}`, { method: "DELETE" });
    loadProducts();
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditInspLevel(p.inspection_level);
    setEditAql(p.aql_level);
    setEditTestDetails(p.test_details || "");
    setEditSupplier(p.supplier || "");
  }

  async function uploadFile(productId: number, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await apiFetch(`/api/products/${productId}/file`, { method: "POST", body: fd });
    loadProducts();
  }

  async function deleteFile(productId: number) {
    await apiFetch(`/api/products/${productId}/file`, { method: "DELETE" });
    loadProducts();
  }

  async function saveEdit(id: number) {
    await apiFetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        inspection_level: editInspLevel,
        aql_level: editAql,
        test_details: editTestDetails,
        supplier: editSupplier,
        company,
      }),
    });
    setEditingId(null);
    loadProducts();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h2 className="text-xl font-bold mb-4">{t("masterList")}</h2>

      {perms.can_manage_products && <form onSubmit={handleAdd} className="bg-white shadow rounded-lg p-6 mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("productName")}</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("productNamePlaceholder")}
            className="w-full border rounded px-3 py-2"
            required
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">{t("inspectionLevel")}</label>
            <select
              value={newInspLevel}
              onChange={(e) => setNewInspLevel(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              {inspectionLevels.map((level) => (
                <option key={level} value={level}>
                  Level {level}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">{t("aqlLevel")}</label>
            <select
              value={newAql}
              onChange={(e) => setNewAql(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              {aqlLevels.map((level) => (
                <option key={level} value={level}>
                  AQL {level}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("testDetails")}</label>
          <textarea
            value={newTestDetails}
            onChange={(e) => setNewTestDetails(e.target.value)}
            placeholder={t("testDetailsPlaceholder")}
            className="w-full border rounded px-3 py-2 h-20 resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("supplier")}</label>
          <select
            value={newSupplier}
            onChange={(e) => setNewSupplier(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">{t("supplierPlaceholder")}</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("file")}</label>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
            onChange={(e) => setNewFile(e.target.files?.[0] || null)}
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div className="col-span-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
          >
            {t("addProduct")}
          </button>
        </div>
      </form>}

      {products.length === 0 ? (
        <p className="text-gray-500">{t("noProducts")}</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="text-left px-3 py-2">{t("id")}</th>
              <th className="text-left px-3 py-2">{t("name")}</th>
              <th className="text-left px-3 py-2">{t("inspectionLevel")}</th>
              <th className="text-left px-3 py-2">{t("aqlLevel")}</th>
              <th className="text-left px-3 py-2">{t("testDetails")}</th>
              <th className="text-left px-3 py-2">{t("supplier")}</th>
              <th className="text-left px-3 py-2">{t("file")}</th>
              <th className="text-left px-3 py-2">{t("dateAdded")}</th>
              <th className="text-left px-3 py-2">{t("addedBy")}</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="border-b bg-yellow-50">
                  <td className="px-3 py-2">{p.id}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="border rounded px-2 py-1 w-full"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={editInspLevel}
                      onChange={(e) => setEditInspLevel(e.target.value)}
                      className="border rounded px-2 py-1 w-full"
                    >
                      {inspectionLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={editAql}
                      onChange={(e) => setEditAql(e.target.value)}
                      className="border rounded px-2 py-1 w-full"
                    >
                      {aqlLevels.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <textarea
                      value={editTestDetails}
                      onChange={(e) => setEditTestDetails(e.target.value)}
                      className="border rounded px-2 py-1 w-full h-16 resize-y text-sm"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={editSupplier}
                      onChange={(e) => setEditSupplier(e.target.value)}
                      className="border rounded px-2 py-1 w-full"
                    >
                      <option value="">{t("supplierPlaceholder")}</option>
                      {suppliers.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                      onChange={(e) => { if (e.target.files?.[0]) uploadFile(p.id, e.target.files[0]); }}
                      className="border rounded px-1 py-0.5 text-xs w-full"
                    />
                    {p.file && <span className="text-xs text-green-600 mt-1 block">{t("viewFile")}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{p.created_by}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => saveEdit(p.id)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      {t("save")}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      {t("cancel")}
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">{p.id}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">{p.inspection_level}</td>
                  <td className="px-3 py-2">{p.aql_level}</td>
                  <td className="px-3 py-2 max-w-48 relative group">
                    {p.test_details ? (
                      <>
                        <span className="block truncate text-sm text-gray-600 cursor-default">
                          {p.test_details}
                        </span>
                        <div className="hidden group-hover:block absolute z-10 left-0 top-full mt-1 bg-gray-800 text-white text-sm rounded p-3 max-w-sm whitespace-pre-wrap shadow-lg">
                          {p.test_details}
                        </div>
                      </>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.supplier === "pending" ? (
                      <span className="text-orange-500 italic text-sm">{t("pendingSupplier")}</span>
                    ) : p.supplier ? (
                      <span className="text-sm">{p.supplier}</span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.file ? (
                      <button
                        onClick={() => setPreviewProduct(p)}
                        className="text-blue-600 hover:text-blue-800 text-sm underline"
                      >
                        {t("viewFile")}
                      </button>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">{p.created_by}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {perms.can_manage_products && (
                      <>
                        <button
                          onClick={() => startEdit(p)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {t("edit")}
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          {t("remove")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
      {/* File Preview Modal */}
      {previewProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewProduct(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">{previewProduct.name} - {previewProduct.file}</h3>
              <div className="flex items-center gap-3">
                <a
                  href={apiUrl(`/api/products/${previewProduct.id}/file`)}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {t("download")}
                </a>
                {perms.can_manage_products && (
                  <button
                    onClick={() => { deleteFile(previewProduct.id); setPreviewProduct(null); }}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    {t("removeFile")}
                  </button>
                )}
                <button
                  onClick={() => setPreviewProduct(null)}
                  className="text-gray-500 hover:text-gray-700 text-xl font-bold leading-none"
                >
                  x
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
              {previewProduct.file.match(/\.pdf$/i) ? (
                <iframe
                  src={apiUrl(`/api/products/${previewProduct.id}/file`)}
                  className="w-full h-[75vh] border-0"
                  title="PDF Preview"
                />
              ) : (
                <img
                  src={apiUrl(`/api/products/${previewProduct.id}/file`)}
                  alt={previewProduct.name}
                  className="max-w-full max-h-[75vh] object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
