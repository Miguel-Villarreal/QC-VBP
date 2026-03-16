"use client";

import { useState, useEffect, useCallback } from "react";
import { useI18n, useCompany, useAuth } from "../../i18n";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Product {
  id: number;
  name: string;
  inspection_level: string;
  aql_level: string;
}

interface PendingInspection {
  id: number;
  product_id: number;
  product_name: string;
  direction: string;
  lot_size: number;
  suggested_sample_size: number | null;
  estimated_date: string;
  created_by: string;
  assigned_to: string;
  companies: string[];
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
  sample_size: number | null;
  accept_number: number | null;
  reject_number: number | null;
  code_letter: string | null;
  date_inspected: string;
  created_by: string;
  created_at: string;
  companies: string[];
  suggested_action: string;
  addressed: boolean;
  addressed_date: string;
  addressed_by: string;
  assigned_to: string;
  released: boolean;
  released_date: string;
  released_by: string;
}

interface AqlResult {
  code_letter: string;
  sample_size: number;
  accept: number | null;
  reject: number | null;
}

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const estimated = new Date(dateStr + "T00:00:00");
  return estimated < today;
}

export default function EventsPage() {
  const { t, lang } = useI18n();
  const { company } = useCompany();
  const { perms } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [events, setEvents] = useState<QCEvent[]>([]);
  const [pending, setPending] = useState<PendingInspection[]>([]);
  const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
  const [usernames, setUsernames] = useState<string[]>([]);
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
  const [aqlPreview, setAqlPreview] = useState<AqlResult | null>(null);

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
    const [prodRes, evtRes, pendRes, actRes, usersRes] = await Promise.all([
      fetch(`${API}/api/products?company=${company}`),
      fetch(`${API}/api/events?company=${company}`),
      fetch(`${API}/api/pending?company=${company}`),
      fetch(`${API}/api/suggested-actions`),
      fetch(`${API}/api/users`),
    ]);
    const prods = await prodRes.json();
    setProducts(prods);
    setEvents(await evtRes.json());
    setPending(await pendRes.json());
    setSuggestedActions(await actRes.json());
    const usersData = await usersRes.json();
    setUsernames(usersData.map((u: { username: string }) => u.username));
    if (prods.length > 0 && !productId) {
      setProductId(String(prods[0].id));
    }
  }, [productId, company]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch AQL preview based on lot size
  const fetchAqlPreview = useCallback(
    async (prodId: string, lot: string) => {
      const product = products.find((p) => p.id === Number(prodId));
      if (!product || !lot || Number(lot) < 1) {
        setAqlPreview(null);
        return;
      }
      try {
        const res = await fetch(
          `${API}/api/aql/lookup?lot_size=${lot}&inspection_level=${encodeURIComponent(product.inspection_level)}&aql_level=${encodeURIComponent(product.aql_level)}`
        );
        if (res.ok) {
          setAqlPreview(await res.json());
        }
      } catch {
        setAqlPreview(null);
      }
    },
    [products]
  );

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
        company,
        created_by: perms.username,
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
    fetchAqlPreview(String(p.product_id), String(p.lot_size));
  }

  function handleCancelInspection() {
    setActivePending(null);
    setLotSize("");
    setQtyInspected("");
    setQtyNonConforming("");
    setDateInspected("");
    setAqlPreview(null);
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
        company,
        created_by: perms.username,
      }),
    });
    setActivePending(null);
    setLotSize("");
    setQtyInspected("");
    setQtyNonConforming("");
    setDateInspected("");
    setAqlPreview(null);
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

  // Addressed fails editing
  const [editingAddressedId, setEditingAddressedId] = useState<number | null>(null);
  const [editAddressedDate, setEditAddressedDate] = useState("");
  const [editAddressedAction, setEditAddressedAction] = useState("");

  async function handleAddress(eventId: number, addressedDate: string) {
    await fetch(`${API}/api/events/${eventId}/address`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressed: true, addressed_date: addressedDate, addressed_by: perms.username }),
    });
    loadData();
  }

  async function assignPending(pendingId: number, assignedTo: string) {
    await fetch(`${API}/api/pending/${pendingId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: assignedTo }),
    });
    loadData();
  }

  async function assignEvent(eventId: number, assignedTo: string) {
    await fetch(`${API}/api/events/${eventId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: assignedTo }),
    });
    loadData();
  }

  async function handleRelease(eventId: number, releaseDate: string) {
    await fetch(`${API}/api/events/${eventId}/release`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released: true, released_date: releaseDate, released_by: perms.username }),
    });
    loadData();
  }

  async function handleUnrelease(eventId: number) {
    await fetch(`${API}/api/events/${eventId}/release`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ released: false }),
    });
    loadData();
  }

  async function handleUnaddress(eventId: number) {
    await fetch(`${API}/api/events/${eventId}/address`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressed: false }),
    });
    loadData();
  }

  function startEditAddressed(ev: QCEvent) {
    setEditingAddressedId(ev.id);
    setEditAddressedDate(ev.addressed_date);
    setEditAddressedAction(ev.suggested_action);
  }

  async function saveEditAddressed(id: number) {
    await setSuggestedAction(id, editAddressedAction);
    await fetch(`${API}/api/events/${id}/address`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressed: true, addressed_date: editAddressedDate }),
    });
    setEditingAddressedId(null);
    loadData();
  }

  async function setSuggestedAction(eventId: number, action: string) {
    await fetch(`${API}/api/events/${eventId}/suggested-action`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggested_action: action }),
    });
    loadData();
  }

  // Split events into categories
  const passedEvents = events.filter(
    (ev) => ev.pass_fail !== "fail" && !ev.released
  );
  const completedFailedEvents = events.filter(
    (ev) => ev.pass_fail === "fail" && !ev.suggested_action
  );
  const failedEvents = events.filter(
    (ev) => ev.pass_fail === "fail" && ev.suggested_action && !ev.addressed
  );
  const addressedEvents = events.filter(
    (ev) => ev.pass_fail === "fail" && ev.suggested_action && ev.addressed && !ev.released
  );
  const releasedEvents = [...passedEvents, ...addressedEvents];
  const releasedProducts = events.filter((ev) => ev.released);

  // Address date state for inline mark-addressed form
  const [addressDates, setAddressDates] = useState<Record<number, string>>({});
  const [releaseDates, setReleaseDates] = useState<Record<number, string>>({});

  // Pagination state per section
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPerPage, setPendingPerPage] = useState(10);
  const [failedNewPage, setFailedNewPage] = useState(1);
  const [failedNewPerPage, setFailedNewPerPage] = useState(10);
  const [awaitingPage, setAwaitingPage] = useState(1);
  const [awaitingPerPage, setAwaitingPerPage] = useState(10);
  const [releasedPage, setReleasedPage] = useState(1);
  const [releasedPerPage, setReleasedPerPage] = useState(10);
  const [releasedProdsPage, setReleasedProdsPage] = useState(1);
  const [releasedProdsPerPage, setReleasedProdsPerPage] = useState(10);

  // Sort state per section
  const [pendingSort, setPendingSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "estimated_date", dir: "asc" });
  const [failedNewSort, setFailedNewSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "id", dir: "desc" });
  const [awaitingSort, setAwaitingSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "id", dir: "desc" });
  const [releasedSort, setReleasedSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "id", dir: "desc" });
  const [releasedProdsSort, setReleasedProdsSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "released_date", dir: "desc" });

  // Reset pages when data changes
  useEffect(() => { setPendingPage(1); }, [pending.length]);
  useEffect(() => { setFailedNewPage(1); }, [completedFailedEvents.length]);
  useEffect(() => { setAwaitingPage(1); }, [failedEvents.length]);
  useEffect(() => { setReleasedPage(1); }, [releasedEvents.length]);
  useEffect(() => { setReleasedProdsPage(1); }, [releasedProducts.length]);

  function toggleSort(
    current: { key: string; dir: "asc" | "desc" },
    setSortState: (s: { key: string; dir: "asc" | "desc" }) => void,
    setPageState: (p: number) => void,
    key: string
  ) {
    if (current.key === key) {
      setSortState({ key, dir: current.dir === "asc" ? "desc" : "asc" });
    } else {
      setSortState({ key, dir: "asc" });
    }
    setPageState(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function sortItems<T>(items: T[], sortKey: string, sortDir: "asc" | "desc"): T[] {
    return [...items].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey];
      const bv = (b as Record<string, unknown>)[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else if (Array.isArray(av) && Array.isArray(bv)) {
        cmp = av.join(",").localeCompare(bv.join(","));
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  function SortArrow({ sortState, column }: { sortState: { key: string; dir: "asc" | "desc" }; column: string }) {
    if (sortState.key !== column) return <span className="text-gray-300 ml-1">&#8597;</span>;
    return <span className="ml-1">{sortState.dir === "asc" ? "\u25B2" : "\u25BC"}</span>;
  }

  function paginate<T>(items: T[], page: number, perPage: number): T[] {
    const start = (page - 1) * perPage;
    return items.slice(start, start + perPage);
  }

  function PaginationControls({ total, page, perPage, setPage, setPerPage }: {
    total: number; page: number; perPage: number;
    setPage: (p: number) => void; setPerPage: (pp: number) => void;
  }) {
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (total <= 10) return null;
    return (
      <div className="flex items-center justify-between mt-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span>{t("showing")} {Math.min((page - 1) * perPage + 1, total)}-{Math.min(page * perPage, total)} {t("of")} {total}</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="border rounded px-2 py-1 text-sm"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>{n} {t("perPage")}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("prev")}
            </button>
            <span className="px-2">{t("page")} {page} {t("of")} {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page >= totalPages}
              className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("next")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compute live pass/fail preview
  const passfailPreview =
    aqlPreview && qtyNonConforming !== ""
      ? aqlPreview.accept !== null
        ? Number(qtyNonConforming) <= aqlPreview.accept
          ? "pass"
          : "fail"
        : null
      : null;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* --- Schedule Pending Inspection --- */}
      <section>
        <h2 className="text-xl font-bold mb-4">{t("scheduleInspection")}</h2>
        <form
          onSubmit={handleSchedule}
          className="bg-white shadow rounded-lg p-6 grid grid-cols-2 gap-4"
        >
          <div>
            <label className="block text-sm font-medium mb-1">{t("product")}</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            >
              {products.length === 0 && (
                <option value="">{t("addProductsFirst")}</option>
              )}
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t("direction")}</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="incoming">{t("incoming")}</option>
              <option value="outgoing">{t("outgoing")}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t("lotSize")}</label>
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
              {t("estimatedDate")}
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
              {t("schedule")}
            </button>
          </div>
        </form>
      </section>

      {/* --- Pending Inspections List --- */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4">{t("pendingInspections")}</h2>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b bg-gray-100">
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "product_name")}>{t("product")}<SortArrow sortState={pendingSort} column="product_name" /></th>
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "direction")}>{t("direction")}<SortArrow sortState={pendingSort} column="direction" /></th>
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "lot_size")}>{t("lotSize")}<SortArrow sortState={pendingSort} column="lot_size" /></th>
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "suggested_sample_size")}>{t("suggestedQty")}<SortArrow sortState={pendingSort} column="suggested_sample_size" /></th>
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "estimated_date")}>{t("estDate")}<SortArrow sortState={pendingSort} column="estimated_date" /></th>
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "companies")}>{t("company")}<SortArrow sortState={pendingSort} column="companies" /></th>
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "created_by")}>{t("user")}<SortArrow sortState={pendingSort} column="created_by" /></th>
                <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(pendingSort, setPendingSort, setPendingPage, "assigned_to")}>{t("assignedTo")}<SortArrow sortState={pendingSort} column="assigned_to" /></th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {paginate(sortItems(pending, pendingSort.key, pendingSort.dir), pendingPage, pendingPerPage).map((p) =>
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
                        <option value="incoming">{t("incoming")}</option>
                        <option value="outgoing">{t("outgoing")}</option>
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
                    <td className="px-3 py-2 text-gray-400">--</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={editPendingDate}
                        onChange={(e) => setEditPendingDate(e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                    <td className="px-3 py-2">{p.companies.join(", ")}</td>
                    <td className="px-3 py-2">{p.created_by}</td>
                    <td className="px-3 py-2">{p.assigned_to || ""}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => saveEditPending(p.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-medium"
                      >
                        {t("save")}
                      </button>
                      <button
                        onClick={() => setEditingPendingId(null)}
                        className="text-gray-500 hover:text-gray-700 text-sm"
                      >
                        {t("cancel")}
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
                    <td className="px-3 py-2">{p.lot_size.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {p.suggested_sample_size !== null
                        ? p.suggested_sample_size.toLocaleString()
                        : <span className="text-gray-400">--</span>}
                    </td>
                    <td className="px-3 py-2">
                      {p.estimated_date}
                      {isOverdue(p.estimated_date) && (
                        <span className="ml-2 text-red-600 text-xs font-semibold">
                          {t("overdue")}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{p.companies.join(", ")}</td>
                    <td className="px-3 py-2">{p.created_by}</td>
                    <td className="px-3 py-2">
                      {perms.can_assign ? (
                        <select
                          value={p.assigned_to || ""}
                          onChange={(e) => assignPending(p.id, e.target.value)}
                          className="border rounded px-2 py-1 text-sm w-full"
                        >
                          <option value="">{t("unassigned")}</option>
                          {usernames.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm">{p.assigned_to || ""}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={() => handleStartInspection(p)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                      >
                        {t("inspect")}
                      </button>
                      {perms.can_edit_pending && (
                        <button
                          onClick={() => startEditPending(p)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {t("edit")}
                        </button>
                      )}
                      {perms.can_delete_pending && (
                        <button
                          onClick={() => deletePending(p.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          {t("delete")}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          <PaginationControls total={pending.length} page={pendingPage} perPage={pendingPerPage} setPage={setPendingPage} setPerPage={setPendingPerPage} />
        </section>
      )}

      {/* --- Complete Inspection Panel --- */}
      {activePending && (
        <section className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">
            {t("completeInspectionTitle")}: {activePending.product_name}
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            {t("direction")}: <span className="capitalize">{direction}</span> |
            {t("lotSize")}: {activePending.lot_size}
          </p>
          <form
            onSubmit={handleCompleteInspection}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("lotSize")}
              </label>
              <input
                type="number"
                min="1"
                value={lotSize}
                onChange={(e) => {
                  setLotSize(e.target.value);
                  fetchAqlPreview(productId, e.target.value);
                }}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t("suggestedInspectionQty")}
              </label>
              <input
                type="text"
                value={aqlPreview ? String(aqlPreview.sample_size) : "--"}
                disabled
                className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                {t("qtyInspected")}
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
                {t("qtyNonConforming")}
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
                {t("dateInspected")}
              </label>
              <input
                type="date"
                value={dateInspected}
                onChange={(e) => setDateInspected(e.target.value)}
                className="w-full border rounded px-3 py-2"
                required
              />
            </div>

            {/* AQL Info Box */}
            {aqlPreview && (
              <div className="bg-white border rounded p-3 text-sm space-y-1">
                <div>
                  <span className="text-gray-500">{t("codeLetter")}:</span>{" "}
                  <span className="font-medium">{aqlPreview.code_letter}</span>
                </div>
                <div>
                  <span className="text-gray-500">{t("acceptReject")}:</span>{" "}
                  <span className="font-medium">
                    {aqlPreview.accept !== null
                      ? `${aqlPreview.accept} / ${aqlPreview.reject}`
                      : "N/A"}
                  </span>
                </div>
                {passfailPreview !== null && (
                  <div>
                    <span className="text-gray-500">{t("resultPreview")}:</span>{" "}
                    {passfailPreview === "pass" ? (
                      <span className="text-green-600 font-bold">PASS</span>
                    ) : (
                      <span className="text-red-600 font-bold">FAIL</span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700"
              >
                {t("completeInspection")}
              </button>
              <button
                type="button"
                onClick={handleCancelInspection}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded font-medium hover:bg-gray-300"
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* --- Completed Failed Events (no suggested action yet) --- */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-orange-600">{t("failedEvents")}</h2>
          {events.length > 0 && (
            <a
              href={`${API}/api/events/export/pdf?lang=${lang}&company=${company}`}
              className="bg-gray-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
            >
              {t("exportPdf")}
            </a>
          )}
        </div>
        {completedFailedEvents.length === 0 ? (
          <p className="text-gray-500">{t("noFailedEvents")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "id")}>{t("id")}<SortArrow sortState={failedNewSort} column="id" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "product_name")}>{t("product")}<SortArrow sortState={failedNewSort} column="product_name" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "direction")}>{t("direction")}<SortArrow sortState={failedNewSort} column="direction" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "lot_size")}>{t("lotSize")}<SortArrow sortState={failedNewSort} column="lot_size" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "sample_size")}>{t("sample")}<SortArrow sortState={failedNewSort} column="sample_size" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "quantity_inspected")}>{t("inspected")}<SortArrow sortState={failedNewSort} column="quantity_inspected" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "quantity_non_conforming")}>{t("nonConf")}<SortArrow sortState={failedNewSort} column="quantity_non_conforming" /></th>
                  <th className="text-left px-3 py-2">Ac/Re</th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "suggested_action")}>{t("suggestedAction")}<SortArrow sortState={failedNewSort} column="suggested_action" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "date_inspected")}>{t("date")}<SortArrow sortState={failedNewSort} column="date_inspected" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "companies")}>{t("company")}<SortArrow sortState={failedNewSort} column="companies" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(failedNewSort, setFailedNewSort, setFailedNewPage, "created_by")}>{t("user")}<SortArrow sortState={failedNewSort} column="created_by" /></th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortItems(completedFailedEvents, failedNewSort.key, failedNewSort.dir), failedNewPage, failedNewPerPage).map((ev) =>
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
                          <option value="incoming">{t("incoming")}</option>
                          <option value="outgoing">{t("outgoing")}</option>
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
                      <td className="px-3 py-2 text-gray-400">--</td>
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
                      <td className="px-3 py-2 text-gray-400">--</td>
                      <td className="px-3 py-2 text-gray-400">--</td>
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
                      <td className="px-3 py-2">{ev.companies.join(", ")}</td>
                      <td className="px-3 py-2">{ev.created_by}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          onClick={() => saveEditEvent(ev.id)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          {t("save")}
                        </button>
                        <button
                          onClick={() => setEditingEventId(null)}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          {t("cancel")}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={ev.id} className="border-b">
                      <td className="px-3 py-2">{ev.id}</td>
                      <td className="px-3 py-2">{ev.product_name}</td>
                      <td className="px-3 py-2 capitalize">{ev.direction}</td>
                      <td className="px-3 py-2">{ev.lot_size.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {ev.sample_size !== null ? ev.sample_size.toLocaleString() : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="px-3 py-2">{ev.quantity_inspected.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {ev.quantity_non_conforming.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {ev.accept_number !== null
                          ? `${ev.accept_number}/${ev.reject_number}`
                          : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="px-3 py-2">
                        {perms.can_set_suggested_action ? (
                          <select
                            value={ev.suggested_action || ""}
                            onChange={(e) => setSuggestedAction(ev.id, e.target.value)}
                            className="border rounded px-2 py-1 text-sm w-full"
                          >
                            <option value="">{t("selectAction")}</option>
                            {suggestedActions.map((a) => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm">{ev.suggested_action || <span className="text-gray-400">--</span>}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {ev.date_inspected}
                      </td>
                      <td className="px-3 py-2">{ev.companies.join(", ")}</td>
                      <td className="px-3 py-2">{ev.created_by}</td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <a
                          href={`${API}/api/events/${ev.id}/export/pdf?lang=${lang}`}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          PDF
                        </a>
                        {perms.can_edit_events && (
                          <button
                            onClick={() => startEditEvent(ev)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            {t("edit")}
                          </button>
                        )}
                        {perms.can_delete_events && (
                          <button
                            onClick={() => deleteEvent(ev.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            {t("delete")}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            <PaginationControls total={completedFailedEvents.length} page={failedNewPage} perPage={failedNewPerPage} setPage={setFailedNewPage} setPerPage={setFailedNewPerPage} />
          </div>
        )}
      </section>

      {/* --- Failed Events (fail + suggested action chosen, not yet addressed) --- */}
      {failedEvents.length > 0 && (
        <section>
          <h2 className="text-xl font-bold mb-4 text-red-700">{t("awaitingFix")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-red-50">
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "id")}>{t("id")}<SortArrow sortState={awaitingSort} column="id" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "product_name")}>{t("product")}<SortArrow sortState={awaitingSort} column="product_name" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "direction")}>{t("direction")}<SortArrow sortState={awaitingSort} column="direction" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "lot_size")}>{t("lotSize")}<SortArrow sortState={awaitingSort} column="lot_size" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "quantity_non_conforming")}>{t("nonConf")}<SortArrow sortState={awaitingSort} column="quantity_non_conforming" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "suggested_action")}>{t("suggestedAction")}<SortArrow sortState={awaitingSort} column="suggested_action" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "date_inspected")}>{t("date")}<SortArrow sortState={awaitingSort} column="date_inspected" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "companies")}>{t("company")}<SortArrow sortState={awaitingSort} column="companies" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "created_by")}>{t("user")}<SortArrow sortState={awaitingSort} column="created_by" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(awaitingSort, setAwaitingSort, setAwaitingPage, "assigned_to")}>{t("assignedTo")}<SortArrow sortState={awaitingSort} column="assigned_to" /></th>
                  <th className="text-left px-3 py-2">{t("addressedDate")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortItems(failedEvents, awaitingSort.key, awaitingSort.dir), awaitingPage, awaitingPerPage).map((ev) => (
                  <tr key={ev.id} className="border-b">
                    <td className="px-3 py-2">{ev.id}</td>
                    <td className="px-3 py-2">{ev.product_name}</td>
                    <td className="px-3 py-2 capitalize">{ev.direction}</td>
                    <td className="px-3 py-2">{ev.lot_size.toLocaleString()}</td>
                    <td className="px-3 py-2">{ev.quantity_non_conforming.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {perms.can_set_suggested_action ? (
                        <select
                          value={ev.suggested_action || ""}
                          onChange={(e) => setSuggestedAction(ev.id, e.target.value)}
                          className="border rounded px-2 py-1 text-sm w-full"
                        >
                          <option value="">{t("selectAction")}</option>
                          {suggestedActions.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm">{ev.suggested_action}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{ev.date_inspected}</td>
                    <td className="px-3 py-2">{ev.companies.join(", ")}</td>
                    <td className="px-3 py-2">{ev.created_by}</td>
                    <td className="px-3 py-2">
                      {perms.can_assign ? (
                        <select
                          value={ev.assigned_to || ""}
                          onChange={(e) => assignEvent(ev.id, e.target.value)}
                          className="border rounded px-2 py-1 text-sm w-full"
                        >
                          <option value="">{t("unassigned")}</option>
                          {usernames.map((u) => (
                            <option key={u} value={u}>{u}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm">{ev.assigned_to || ""}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={addressDates[ev.id] || new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setAddressDates((prev) => ({ ...prev, [ev.id]: e.target.value }))}
                        className="border rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      {perms.can_mark_addressed && (
                        <button
                          onClick={() => handleAddress(ev.id, addressDates[ev.id] || new Date().toISOString().slice(0, 10))}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          {t("markAddressed")}
                        </button>
                      )}
                      <a
                        href={`${API}/api/events/${ev.id}/export/pdf?lang=${lang}`}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={failedEvents.length} page={awaitingPage} perPage={awaitingPerPage} setPage={setAwaitingPage} setPerPage={setAwaitingPerPage} />
          </div>
        </section>
      )}

      {/* --- Passed Events (passed + addressed fails merged) --- */}
      <section>
        <h2 className="text-xl font-bold mb-4">{t("passedEvents")}</h2>
        {releasedEvents.length === 0 ? (
          <p className="text-gray-500">{t("noPassedEvents")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-gray-100">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "id")}>{t("id")}<SortArrow sortState={releasedSort} column="id" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "product_name")}>{t("product")}<SortArrow sortState={releasedSort} column="product_name" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "direction")}>{t("direction")}<SortArrow sortState={releasedSort} column="direction" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "lot_size")}>{t("lotSize")}<SortArrow sortState={releasedSort} column="lot_size" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "sample_size")}>{t("sample")}<SortArrow sortState={releasedSort} column="sample_size" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "quantity_inspected")}>{t("inspected")}<SortArrow sortState={releasedSort} column="quantity_inspected" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "quantity_non_conforming")}>{t("nonConf")}<SortArrow sortState={releasedSort} column="quantity_non_conforming" /></th>
                  <th className="text-left px-3 py-2">Ac/Re</th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "date_inspected")}>{t("date")}<SortArrow sortState={releasedSort} column="date_inspected" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "companies")}>{t("company")}<SortArrow sortState={releasedSort} column="companies" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedSort, setReleasedSort, setReleasedPage, "created_by")}>{t("resolvedBy")}<SortArrow sortState={releasedSort} column="created_by" /></th>
                  <th className="text-left px-3 py-2">{t("releasedDate")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortItems(releasedEvents, releasedSort.key, releasedSort.dir), releasedPage, releasedPerPage).map((ev) =>
                  ev.addressed && editingAddressedId === ev.id ? (
                    <tr key={ev.id} className="border-b bg-yellow-50">
                      <td className="px-2 py-2 text-center">
                        <svg className="w-4 h-4 text-orange-500 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                      </td>
                      <td className="px-3 py-2">{ev.id}</td>
                      <td className="px-3 py-2">{ev.product_name}</td>
                      <td className="px-3 py-2 capitalize">{ev.direction}</td>
                      <td className="px-3 py-2">{ev.lot_size.toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-400">--</td>
                      <td className="px-3 py-2">{ev.quantity_inspected.toLocaleString()}</td>
                      <td className="px-3 py-2">{ev.quantity_non_conforming.toLocaleString()}</td>
                      <td className="px-3 py-2 text-gray-400">--</td>
                      <td className="px-3 py-2">{ev.date_inspected}</td>
                      <td className="px-3 py-2">{ev.companies.join(", ")}</td>
                      <td className="px-3 py-2">{ev.addressed ? ev.addressed_by : ev.created_by}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          onClick={() => saveEditAddressed(ev.id)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          {t("save")}
                        </button>
                        <button
                          onClick={() => setEditingAddressedId(null)}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          {t("cancel")}
                        </button>
                      </td>
                    </tr>
                  ) : editingEventId === ev.id ? (
                    <tr key={ev.id} className="border-b bg-yellow-50">
                      <td className="px-2 py-2 text-center">
                        <svg className="w-4 h-4 text-green-500 inline-block" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      </td>
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
                          <option value="incoming">{t("incoming")}</option>
                          <option value="outgoing">{t("outgoing")}</option>
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
                      <td className="px-3 py-2 text-gray-400">--</td>
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
                      <td className="px-3 py-2 text-gray-400">--</td>
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
                      <td className="px-3 py-2">{ev.companies.join(", ")}</td>
                      <td className="px-3 py-2">{ev.addressed ? ev.addressed_by : ev.created_by}</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          onClick={() => saveEditEvent(ev.id)}
                          className="text-green-600 hover:text-green-800 text-sm font-medium"
                        >
                          {t("save")}
                        </button>
                        <button
                          onClick={() => setEditingEventId(null)}
                          className="text-gray-500 hover:text-gray-700 text-sm"
                        >
                          {t("cancel")}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={ev.id} className="border-b">
                      <td className="px-2 py-2 text-center">
                        {ev.addressed ? (
                          <svg className="w-4 h-4 text-orange-500 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                        ) : (
                          <svg className="w-4 h-4 text-green-500 inline-block" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                      </td>
                      <td className="px-3 py-2">{ev.id}</td>
                      <td className="px-3 py-2">{ev.product_name}</td>
                      <td className="px-3 py-2 capitalize">{ev.direction}</td>
                      <td className="px-3 py-2">{ev.lot_size.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {ev.sample_size !== null ? ev.sample_size.toLocaleString() : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="px-3 py-2">{ev.quantity_inspected.toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {ev.quantity_non_conforming.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {ev.accept_number !== null
                          ? `${ev.accept_number}/${ev.reject_number}`
                          : <span className="text-gray-400">--</span>}
                      </td>
                      <td className="px-3 py-2">
                        {ev.date_inspected}
                      </td>
                      <td className="px-3 py-2">{ev.companies.join(", ")}</td>
                      <td className="px-3 py-2">{ev.addressed ? ev.addressed_by : ev.created_by}</td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          value={releaseDates[ev.id] || new Date().toISOString().slice(0, 10)}
                          onChange={(e) => setReleaseDates((prev) => ({ ...prev, [ev.id]: e.target.value }))}
                          className="border rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        <button
                          onClick={() => handleRelease(ev.id, releaseDates[ev.id] || new Date().toISOString().slice(0, 10))}
                          className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                        >
                          {t("release")}
                        </button>
                        <a
                          href={`${API}/api/events/${ev.id}/export/pdf?lang=${lang}`}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          PDF
                        </a>
                        {ev.addressed ? (
                          <>
                            {perms.can_edit_addressed && (
                              <button
                                onClick={() => startEditAddressed(ev)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                {t("edit")}
                              </button>
                            )}
                            {perms.can_mark_addressed && (
                              <button
                                onClick={() => handleUnaddress(ev.id)}
                                className="text-orange-600 hover:text-orange-800 text-sm"
                              >
                                {t("unaddress")}
                              </button>
                            )}
                            {perms.can_delete_addressed && (
                              <button
                                onClick={() => deleteEvent(ev.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                {t("delete")}
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            {perms.can_edit_events && (
                              <button
                                onClick={() => startEditEvent(ev)}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                {t("edit")}
                              </button>
                            )}
                            {perms.can_delete_events && (
                              <button
                                onClick={() => deleteEvent(ev.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                {t("delete")}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
            <PaginationControls total={releasedEvents.length} page={releasedPage} perPage={releasedPerPage} setPage={setReleasedPage} setPerPage={setReleasedPerPage} />
          </div>
        )}
      </section>

      {/* --- Released Products --- */}
      <section>
        <h2 className="text-xl font-bold mb-4 text-purple-700">{t("releasedProducts")}</h2>
        {releasedProducts.length === 0 ? (
          <p className="text-gray-500">{t("noReleasedProducts")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-purple-50">
                  <th className="w-8 px-2 py-2"></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "id")}>{t("id")}<SortArrow sortState={releasedProdsSort} column="id" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "product_name")}>{t("product")}<SortArrow sortState={releasedProdsSort} column="product_name" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "direction")}>{t("direction")}<SortArrow sortState={releasedProdsSort} column="direction" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "lot_size")}>{t("lotSize")}<SortArrow sortState={releasedProdsSort} column="lot_size" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "date_inspected")}>{t("date")}<SortArrow sortState={releasedProdsSort} column="date_inspected" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "companies")}>{t("company")}<SortArrow sortState={releasedProdsSort} column="companies" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "released_date")}>{t("releasedDate")}<SortArrow sortState={releasedProdsSort} column="released_date" /></th>
                  <th className="text-left px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort(releasedProdsSort, setReleasedProdsSort, setReleasedProdsPage, "released_by")}>{t("releasedBy")}<SortArrow sortState={releasedProdsSort} column="released_by" /></th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortItems(releasedProducts, releasedProdsSort.key, releasedProdsSort.dir), releasedProdsPage, releasedProdsPerPage).map((ev) => (
                  <tr key={ev.id} className="border-b">
                    <td className="px-2 py-2 text-center">
                      {ev.addressed ? (
                        <svg className="w-4 h-4 text-orange-500 inline-block" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
                      ) : (
                        <svg className="w-4 h-4 text-green-500 inline-block" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      )}
                    </td>
                    <td className="px-3 py-2">{ev.id}</td>
                    <td className="px-3 py-2">{ev.product_name}</td>
                    <td className="px-3 py-2 capitalize">{ev.direction}</td>
                    <td className="px-3 py-2">{ev.lot_size.toLocaleString()}</td>
                    <td className="px-3 py-2">{ev.date_inspected}</td>
                    <td className="px-3 py-2">{ev.companies.join(", ")}</td>
                    <td className="px-3 py-2">{ev.released_date}</td>
                    <td className="px-3 py-2">{ev.released_by}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <a
                        href={`${API}/api/events/${ev.id}/export/pdf?lang=${lang}`}
                        className="text-gray-600 hover:text-gray-800 text-sm"
                      >
                        PDF
                      </a>
                      <button
                        onClick={() => handleUnrelease(ev.id)}
                        className="text-orange-600 hover:text-orange-800 text-sm"
                      >
                        {t("unrelease")}
                      </button>
                      {perms.can_delete_events && (
                        <button
                          onClick={() => deleteEvent(ev.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          {t("delete")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationControls total={releasedProducts.length} page={releasedProdsPage} perPage={releasedProdsPerPage} setPage={setReleasedProdsPage} setPerPage={setReleasedProdsPerPage} />
          </div>
        )}
      </section>

    </div>
  );
}
