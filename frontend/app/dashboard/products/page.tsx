"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Product {
  id: number;
  name: string;
  inspection_level: string;
  aql_level: string;
  created_at: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [aqlLevels, setAqlLevels] = useState<string[]>([]);
  const [inspectionLevels, setInspectionLevels] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [newInspLevel, setNewInspLevel] = useState("");
  const [newAql, setNewAql] = useState("");

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editInspLevel, setEditInspLevel] = useState("");
  const [editAql, setEditAql] = useState("");

  const loadProducts = useCallback(async () => {
    const res = await fetch(`${API}/api/products`);
    setProducts(await res.json());
  }, []);

  useEffect(() => {
    loadProducts();
    Promise.all([
      fetch(`${API}/api/aql-levels`).then((r) => r.json()),
      fetch(`${API}/api/inspection-levels`).then((r) => r.json()),
    ]).then(([aqls, insps]) => {
      setAqlLevels(aqls);
      setNewAql(aqls[0] || "");
      setInspectionLevels(insps);
      setNewInspLevel(insps[1] || insps[0] || ""); // default to "II"
    });
  }, [loadProducts]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await fetch(`${API}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        inspection_level: newInspLevel,
        aql_level: newAql,
      }),
    });
    setNewName("");
    loadProducts();
  }

  async function handleDelete(id: number) {
    await fetch(`${API}/api/products/${id}`, { method: "DELETE" });
    loadProducts();
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditInspLevel(p.inspection_level);
    setEditAql(p.aql_level);
  }

  async function saveEdit(id: number) {
    await fetch(`${API}/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName.trim(),
        inspection_level: editInspLevel,
        aql_level: editAql,
      }),
    });
    setEditingId(null);
    loadProducts();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Master List</h2>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6 items-end">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Product name"
          className="flex-1 border rounded px-3 py-2"
          required
        />
        <select
          value={newInspLevel}
          onChange={(e) => setNewInspLevel(e.target.value)}
          className="border rounded px-3 py-2"
          required
        >
          {inspectionLevels.map((level) => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
        </select>
        <select
          value={newAql}
          onChange={(e) => setNewAql(e.target.value)}
          className="border rounded px-3 py-2"
          required
        >
          {aqlLevels.map((level) => (
            <option key={level} value={level}>
              AQL {level}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
        >
          Add Product
        </button>
      </form>

      {products.length === 0 ? (
        <p className="text-gray-500">No products yet. Add one above.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b bg-gray-100">
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Inspection Level</th>
              <th className="text-left px-3 py-2">AQL Level</th>
              <th className="text-left px-3 py-2">Date Added</th>
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
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => saveEdit(p.id)}
                      className="text-green-600 hover:text-green-800 text-sm font-medium"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="text-gray-500 hover:text-gray-700 text-sm"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="border-b">
                  <td className="px-3 py-2">{p.id}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">{p.inspection_level}</td>
                  <td className="px-3 py-2">{p.aql_level}</td>
                  <td className="px-3 py-2">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
