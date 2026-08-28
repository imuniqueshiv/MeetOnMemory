import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import apiClient from "../../services/apiClient.js";
import StarRating from "../testimonials/StarRating.jsx";

const STATUS_FILTERS = ["pending", "approved", "rejected", "all"];

export default function TestimonialsModeration() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = { page: 1, limit: 50 };
      if (status !== "all") params.status = status;
      const { data } = await apiClient.get("/api/admin/testimonials", {
        params,
      });
      setItems(data.testimonials || []);
      setSelectedIds([]);
    } catch {
      setError("Unable to load testimonials for moderation.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.length === items.length,
    [items, selectedIds],
  );

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((item) => item.id));
  };

  const updateStatus = async (id, nextStatus) => {
    setBusyId(id);
    try {
      await apiClient.patch(`/api/admin/testimonials/${id}/status`, {
        status: nextStatus,
      });
      toast.success(`Marked as ${nextStatus}`);
      await load();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to update moderation status",
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Remove this testimonial permanently?")) return;
    setBusyId(id);
    try {
      await apiClient.delete(`/api/admin/testimonials/${id}`);
      toast.success("Testimonial removed");
      await load();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to remove testimonial",
      );
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async (action) => {
    if (!selectedIds.length) {
      toast.info("Select at least one testimonial");
      return;
    }
    if (
      action === "delete" &&
      !window.confirm(
        `Remove ${selectedIds.length} selected testimonial(s) permanently?`,
      )
    ) {
      return;
    }

    setBulkBusy(true);
    try {
      const { data } = await apiClient.post("/api/admin/testimonials/bulk", {
        ids: selectedIds,
        action,
      });
      toast.success(data.message || "Bulk action applied");
      await load();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to apply bulk action",
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const updateSpotlight = async (item, next) => {
    setBusyId(item.id);
    try {
      await apiClient.patch(
        `/api/admin/testimonials/${item.id}/spotlight`,
        next,
      );
      toast.success(
        next.featuredOnHomepage
          ? "Featured on homepage"
          : "Removed from homepage spotlight",
      );
      await load();
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to update homepage spotlight",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter by status"
      >
        {STATUS_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize cursor-pointer ${
              status === value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {!loading && !error && items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              aria-label="Select all testimonials"
            />
            Select all ({selectedIds.length})
          </label>
          <button
            type="button"
            disabled={bulkBusy || !selectedIds.length}
            onClick={() => runBulk("approve")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white disabled:opacity-50 cursor-pointer"
          >
            Bulk approve
          </button>
          <button
            type="button"
            disabled={bulkBusy || !selectedIds.length}
            onClick={() => runBulk("reject")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white disabled:opacity-50 cursor-pointer"
          >
            Bulk reject
          </button>
          <button
            type="button"
            disabled={bulkBusy || !selectedIds.length}
            onClick={() => runBulk("delete")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white disabled:opacity-50 cursor-pointer"
          >
            Bulk delete
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4 py-10 text-center text-sm text-slate-500">
          No testimonials in this filter.
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelect(item.id)}
                      aria-label={`Select testimonial by ${item.user?.name || "user"}`}
                    />
                    <StarRating value={item.rating} readOnly size="sm" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {item.status}
                    </span>
                    {item.featuredOnHomepage ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                        Spotlight #{item.spotlightOrder ?? 0}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-800 dark:text-slate-200">
                    &ldquo;{item.comment}&rdquo;
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.user?.name || "Unknown user"}
                    {item.organization?.name
                      ? ` · ${item.organization.name}`
                      : ""}
                    {item.createdAt
                      ? ` · ${new Date(item.createdAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.status !== "approved" ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => updateStatus(item.id, "approved")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white disabled:opacity-50 cursor-pointer"
                    >
                      Approve
                    </button>
                  ) : null}
                  {item.status !== "rejected" ? (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => updateStatus(item.id, "rejected")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                  ) : null}
                  {item.status === "approved" ? (
                    <>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() =>
                          updateSpotlight(item, {
                            featuredOnHomepage: !item.featuredOnHomepage,
                            spotlightOrder: item.spotlightOrder || 0,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white disabled:opacity-50 cursor-pointer"
                      >
                        {item.featuredOnHomepage
                          ? "Unfeature"
                          : "Feature on homepage"}
                      </button>
                      {item.featuredOnHomepage ? (
                        <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                          Order
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            defaultValue={item.spotlightOrder || 0}
                            disabled={busyId === item.id}
                            onBlur={(e) => {
                              const nextOrder = Number(e.target.value);
                              if (
                                !Number.isFinite(nextOrder) ||
                                nextOrder === (item.spotlightOrder || 0)
                              ) {
                                return;
                              }
                              updateSpotlight(item, {
                                featuredOnHomepage: true,
                                spotlightOrder: Math.max(
                                  0,
                                  Math.floor(nextOrder),
                                ),
                              });
                            }}
                            className="w-16 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1"
                            aria-label="Homepage spotlight order"
                          />
                        </label>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => remove(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white disabled:opacity-50 cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
