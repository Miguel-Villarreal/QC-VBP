"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Product {
  id: number;
  name: string;
}

interface PendingInspection {
  id: number;
  product_id: number;
  product_name: string;
  direction: string;
  lot_size: number;
  estimated_date: string;
}

interface QCEvent {
  id: number;
  product_id: number;
  product_name: string;
  direction: string;
  lot_size: number;
  quantity_inspected: number;
  quantity_non_conforming: number;
  pass_fail: string | null;
  date_inspected: string;
  created_at: string;
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const estimated = new Date(dateStr + "T00:00:00");
  return estimated < today;
}

export default function EventsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<QCEvent[]>([]);
  const [pending, setPending] = useState<PendingInspection[]>([]);
  const [productId, setProductId] = useState("");
  const [direction, setDirection] = useState("incoming");

  // Pending inspection form
  const [pendingLotSize, setPendingLotSize] = useState("");
  const [pendingDate, setPendingDate] = useState("");

  // Event form (for completing an inspection)
  const [activePending, setActivePending] = useState<PendingInspection | null>(
    null
  );
  const [lotSize, setLotSize] = useState("");
  const [qtyInspected, setQtyInspected] = useState("");
  const [qtyNonConforming, setQtyNonConforming] = useState("");
  const [dateInspected, setDateInspected] = useState("");

  // Editing pending inspection
  const [editingPendingId, setEditingPendingId] = useState<number | null>(null);
  const [editPendingProductId, setEditPendingProductId] = useState("");
  const [editPendingDirection, setEditPendingDirection] = useState("");
  const [editPendingLotSize, setEditPendingLotSize] = useState("");
  const [editPendingDate, setEditPendingDate] = useState("");

  // Editing event
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [editEventProductId, setEditEventProductId] = useState("");
  const [editEventDirection, setEditEventDirection] = useState("");
  const [editEventLotSize, setEditEventLotSize] = useState("");
  const [editEventQtyInspected, setEditEventQtyInspected] = useState("");
  const [editEventQtyNonConforming, setEditEventQtyNonConforming] =
    useState("");
  const [editEventDateInspected, setEditEventDateInspected] = useState("");

  const loadData = useCallback(async () => {
    const [prodRes, evtRes, pendRes] = await Promise.all([
      fetch(`${API}/api/products`),
      fetch(`${API}/api/events`),
      fetch(`${API}/api/pending`),
    ]);
    const prods = await prodRes.json();
    setProducts(prods);
    setEvents(await evtRes.json());
    setPending(await pendRes.json());
    if (prods.length > 0 && !productId) {
      setProductId(String(prods[0].id));
    }
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Schedule ---
  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${API}/api/pending`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: Number(productId),
        direction,
        lot_size: Number(pendingLotSize),
        estimated_date: pendingDate,
      }),
    });
    setPendingLotSize("");
    setPendingDate("");
    loadData();
  }

  // --- Inspect from pending ---
  function handleStartInspection(p: PendingInspection) {
    setActivePending(p);
    setProductId(String(p.product_id));
    setDirection(p.direction);
    setLotSize(String(p.lot_size));
    setQtyInspected("");
    setQtyNonConforming("");
    setDateInspected(new Date().toISOString().slice(0, 10));
    setEditingPendingId(null);
    setEditingEventId(null);
  }

  function handleCancelInspection() {
    setActivePending(null);
    setLotSize("");
    setQtyInspected("");
    setQtyNonConforming("");
    setDateInspected("");
  }

  async function handleCompleteInspection(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`${API}/api/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: Number(productId),
        direction,
        lot_size: Number(lotSize),
        quantity_inspected: Number(qtyInspected),
        quantity_non_conforming: Number(qtyNonConforming),
        date_inspected: dateInspected,
        pending_id: activePending?.id ?? null,
      }),
    });
    setActivePending(null);
    setLotSize("");
    setQtyInspected("");
    setQtyNonConforming("");
    setDateInspected("");
    loadData();
  }

  // --- Edit/Delete Pending ---
  function startEditPending(p: PendingInspection) {
    setEditingPendingId(p.id);
    setEditPendingProductId(String(p.product_id));
    setEditPendingDirection(p.direction);
    setEditPendingLotSize(String(p.lot_size));
    setEditPendingDate(p.estimated_date);
  }

  async function saveEditPending(id: number) {
    await fetch(`${API}/api/pending/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: Number(editPendingProductId),
        direction: editPendingDirection,
        lot_size: Number(editPendingLotSize),
        estimated_date: editPendingDate,
      }),
    });
    setEditingPendingId(null);
    loadData();
  }

  async function deletePending(id: number) {
    await fetch(`${API}/api/pending/${id}`, { method: "DELETE" });
    loadData();
  }

  // --- Edit/Delete Event ---
  function startEditEvent(ev: QCEvent) {
    setEditingEventId(ev.id);
    setEditEventProductId(String(ev.product_id));
    setEditEventDirection(ev.direction);
    setEditEventLotSize(String(ev.lot_size));
    setEditEventQtyInspected(String(ev.quantity_inspected));
    setEditEventQtyNonConforming(String(ev.quantity_non_conforming));
    setEditEventDateInspected(ev.date_inspected);
  }

  async function saveEditEvent(id: number) {
    await fetch(`${API}/api/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: Number(editEventProductId),
        direction: editEventDirection,
        lot_size: Number(editEventLotSize),
        quantity_inspected: Number(editEventQtyInspected),
        quantity_non_conforming: Number(editEventQtyNonConforming),
        date_inspected: editEventDateInspected,
      }),
    });
    setEditingEventId(null);
    loadData();
  }

  async function deleteEvent(id: number) {
    await fetch(`${API}/api/events/${id}`, { method: "DELETE" });
    loadData();
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* --- Schedule Pending Inspection --- */}
      <section>
        <h2 className="text-xl font-bold mb-4">Schedule Inspection</h2>
        <form
          onSubmit={handleSchedule}
          className="bg-white shadow rounded-lg p-6 grid grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">Product</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              {products.length === 0 && (
                <option value="">-- Add products first --</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="incoming">Incoming</option>
              <option value="outgoing">Outgoing</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Lot Size</label>
            <input
              type="number"
              min="1"
              value={pendingLotSize}
              onChange={(e) => setPendingLotSize(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Estimated Date
            </label>
            <input
              type="date"
              value={pendingDate}
              onChange={(e) => setPendingDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={products.length === 0}
              className="bg-gray-700 text-white px-6 py-2 rounded font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              Schedule
            </button>
          </div>
        </form>
      </section>

      {/* --- Pending Inspections List --- */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">Pending Inspections</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-left px-3 py-2">Direction</th>
                <th className="text-left px-3 py-2">Lot Size</th>
                <th className="text-left px-3 py-2">Suggested Qty</th>
                <th className="text-left px-3 py-2">Est. Date</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) =>
                editingPendingId === p.id ? (
                  <tr key={p.id} className="border-b bg-yellow-50">
                    <td className="px-3 py-2">
                      <select
                        value={editPendingProductId}
                        onChange={(e) =>
                          setEditPendingProductId(e.target.value)
                        }
                        className="border rounded px-2 py-1 w-full"
                      >
                        {products.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editPendingDirection}
                        onChange={(e) =>
                          setEditPendingDirection(e.target.value)
                        }
                        className="border rounded px-2 py-1 w-full"
                      >
                        <option value="incoming">Incoming</option>
                        <option value="outgoing">Outgoing</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={editPendingLotSize}
                        onChange={(e) => setEditPendingLotSize(e.target.value)}
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    {/* TODO: populate from AQL table based on lot size + inspection level */}
                    <td className="px-3 py-2 text-gray-400">--</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={editPendingDate}
                        onChange={(e) => setEditPendingDate(e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => saveEditPending(p.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPendingId(null)}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={p.id}
                    className={`border-b ${
                      isOverdue(p.estimated_date) ? "bg-red-50" : ""
                    }`}
                  >
                    <td className="px-3 py-2">{p.product_name}</td>
                    <td className="px-3 py-2 capitalize">{p.direction}</td>
                    <td className="px-3 py-2">{p.lot_size}</td>
                    {/* TODO: populate from AQL table based on lot size + inspection level */}
                    <td className="px-3 py-2 text-gray-400">--</td>
                    <td className="px-3 py-2">
                      {p.estimated_date}
                      {isOverdue(p.estimated_date) && (
                        <span className="ml-2 text-red-600 text-xs font-semibold">
                          OVERDUE
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => handleStartInspection(p)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => startEditPending(p)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deletePending(p.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* --- Complete Inspection Modal --- */}
      {activePending && (
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            Complete Inspection: {activePending.product_name}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Direction: <span className="capitalize">{direction}</span> |
            Lot Size: {activePending.lot_size}
          </p>
          <form
            onSubmit={handleCompleteInspection}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                Lot Size
              </label>
              <input
                type="number"
                min="1"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            {/* TODO: populate from AQL table based on lot size + inspection level */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Suggested Inspection Qty
              </label>
              <input
                type="text"
                value="--"
                disabled
                className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Qty Inspected
              </label>
              <input
                type="number"
                min="0"
                value={qtyInspected}
                onChange={(e) => setQtyInspected(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Qty Non-Conforming
              </label>
              <input
                type="number"
                min="0"
                value={qtyNonConforming}
                onChange={(e) => setQtyNonConforming(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Date Inspected
              </label>
              <input
                type="date"
                value={dateInspected}
                onChange={(e) => setDateInspected(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700"
              >
                Complete Inspection
              </button>
              <button
                type="button"
                onClick={handleCancelInspection}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* --- Completed Events --- */}
      <section>
        <h2 className="text-xl font-bold mb-4">Completed Events</h2>
        {events.length === 0 ? (
          <p className="text-gray-500">No events recorded yet.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="text-left px-3 py-2">ID</th>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-left px-3 py-2">Direction</th>
                <th className="text-left px-3 py-2">Lot Size</th>
                <th className="text-left px-3 py-2">Inspected</th>
                <th className="text-left px-3 py-2">Non-Conforming</th>
                <th className="text-left px-3 py-2">Pass/Fail</th>
                <th className="text-left px-3 py-2">Date Inspected</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) =>
                editingEventId === ev.id ? (
                  <tr key={ev.id} className="border-b bg-yellow-50">
                    <td className="px-3 py-2">{ev.id}</td>
                    <td className="px-3 py-2">
                      <select
                        value={editEventProductId}
                        onChange={(e) =>
                          setEditEventProductId(e.target.value)
                        }
                        className="border rounded px-2 py-1 w-full"
                      >
                        {products.map((pr) => (
                          <option key={pr.id} value={pr.id}>
                            {pr.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={editEventDirection}
                        onChange={(e) =>
                          setEditEventDirection(e.target.value)
                        }
                        className="border rounded px-2 py-1 w-full"
                      >
                        <option value="incoming">Incoming</option>
                        <option value="outgoing">Outgoing</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        value={editEventLotSize}
                        onChange={(e) =>
                          setEditEventLotSize(e.target.value)
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={editEventQtyInspected}
                        onChange={(e) =>
                          setEditEventQtyInspected(e.target.value)
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        value={editEventQtyNonConforming}
                        onChange={(e) =>
                          setEditEventQtyNonConforming(e.target.value)
                        }
                        className="border rounded px-2 py-1 w-20"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-gray-400">--</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={editEventDateInspected}
                        onChange={(e) =>
                          setEditEventDateInspected(e.target.value)
                        }
                        className="border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => saveEditEvent(ev.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingEventId(null)}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={ev.id} className="border-b">
                    <td className="px-3 py-2">{ev.id}</td>
                    <td className="px-3 py-2">{ev.product_name}</td>
                    <td className="px-3 py-2 capitalize">{ev.direction}</td>
                    <td className="px-3 py-2">{ev.lot_size}</td>
                    <td className="px-3 py-2">{ev.quantity_inspected}</td>
                    <td className="px-3 py-2">
                      {ev.quantity_non_conforming}
                    </td>
                    <td className="px-3 py-2">
                      {ev.pass_fail === null ? (
                        <span className="text-gray-400">--</span>
                      ) : ev.pass_fail === "pass" ? (
                        <span className="text-green-600 font-medium">
                          Pass
                        </span>
                      ) : (
                        <span className="text-red-600 font-medium">Fail</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {ev.date_inspected}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => startEditEvent(ev)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEvent(ev.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
