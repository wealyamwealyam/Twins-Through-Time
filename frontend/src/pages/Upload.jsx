import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import MetadataReviewPopup from "../components/MetadataPopup";

const STORAGE_KEY = "ttt_scrape_runs";

function loadRuns() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRuns(runs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

function StatusBadge({ status }) {
  const styles = {
    pending:    "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    complete:   "bg-green-100 text-green-800",
    failed:     "bg-red-100 text-red-800",
  };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${styles[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.oneOf(["pending", "processing", "complete", "failed"]).isRequired,
};

export default function Upload() {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [runs, setRuns] = useState(loadRuns);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [openReview, setOpenReview] = useState(false);
  const images = [
    { id: "1", src: "/Twins-Through-Time/DemoPictures/Grenville-M.-Dodge.jpg", fileName: "Grenville-M.-Dodge.jpg" },
    { id: "2", src: "/Twins-Through-Time/DemoPictures/oldguy.jpg", fileName: "oldguy.jpg" },
    { id: "3", src: "/Twins-Through-Time/DemoPictures/youngkid.jpg", fileName: "youngkid.jpg" },
  ];

  useEffect(() => {
    saveRuns(runs);
  }, [runs]);

  function isValidUrl(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }
    if (!isValidUrl(url.trim())) {
      setError("That doesn't look like a valid URL. Make sure it starts with https://");
      return;
    }

    setSubmitting(true);

    // (mock)
    const newRun = {
      id: crypto.randomUUID(),
      url: url.trim(),
      label: label.trim() || null,
      status: "processing",
      submittedAt: new Date().toISOString(),
      imagesFound: null,
      flagged: null,
    };

    setRuns((prev) => [newRun, ...prev]);
    setUrl("");
    setLabel("");

    setTimeout(() => {
      setRuns((prev) =>
        prev.map((r) =>
          r.id === newRun.id
            ? {
                ...r,
                status: "complete",
                imagesFound: Math.floor(Math.random() * 40) + 5,
                flagged: Math.floor(Math.random() * 6),
              }
            : r
        )
      );
      setSubmitting(false);
    }, 1800);
  }

  function confirmDelete(id) {
    setDeleteId(id);
  }

  function handleDelete() {
    setRuns((prev) => prev.filter((r) => r.id !== deleteId));
    setDeleteId(null);
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="max-w-6xl mx-auto">

      {/* PAGE HEADER */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Upload</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Paste a Civil War photo archive URL to begin scraping images and metadata.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT — FORM */}
        <div className="lg:col-span-2 space-y-6">

          {/* URL INPUT CARD */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900">New scrape</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter the URL of a photo archive page. The scraper will collect image URLs and available metadata.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Archive URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); }}
                  placeholder="https://example.com/civil-war-photos"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                />
                {error && (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Label <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Library of Congress – Batch 3"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Scraping…
                    </>
                  ) : "Start scrape"}
                </button>
                <button
                  type="button"
                  onClick={() => { setUrl(""); setLabel(""); setError(""); }}
                  className="text-sm font-medium text-gray-500 hover:text-gray-900 transition"
                >
                  Clear
                </button>
              </div>
            </form>
            <br/>
            <button
                  onClick={() => setOpenReview(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  demo scrape
              </button>
          </div>

          {/* RUNS LIST */}
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Scrape runs
                {runs.length > 0 && (
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {runs.length}
                  </span>
                )}
              </h2>
              {runs.length > 0 && (
                <button
                  onClick={() => { if (window.confirm("Clear all runs from local storage?")) { setRuns([]); } }}
                  className="text-xs font-medium text-gray-400 hover:text-red-600 transition"
                >
                  Clear all
                </button>
              )}
            </div>

            {runs.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-900">No runs yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Paste a URL above to kick off your first scrape.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-gray-100">
                {runs.map((run) => (
                  <div key={run.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">
                          {run.label || "Unlabeled run"}
                        </span>
                        <StatusBadge status={run.status} />
                      </div>

                      <p className="mt-0.5 text-xs text-gray-400 truncate">{run.url}</p>

                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span>{formatDate(run.submittedAt)}</span>
                        {run.imagesFound !== null && (
                          <>
                            <span>•</span>
                            <span>{run.imagesFound} images found</span>
                            <span>•</span>
                            <span>{run.flagged} flagged</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {run.status === "complete" && (
                        <Link
                          to="/history"
                          className="text-xs font-semibold text-gray-900 hover:underline"
                        >
                          Review →
                        </Link>
                      )}
                      <button
                        onClick={() => confirmDelete(run.id)}
                        className="text-xs text-gray-300 hover:text-red-500 transition font-medium"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — INFO SIDEBAR */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900">Supported sources</h3>
            <p className="mt-2 text-xs text-gray-500">
              Initial rollout targets a small set of known archive pages. More sources will be added in upcoming sprints.
            </p>
            <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
              {[
                "Library of Congress",
                "Smithsonian Archives",
                "Getty Civil War collection",
                "Custom archive pages (beta)",
              ].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900">What gets captured</h3>
            <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
              {[
                "Image URL & thumbnail",
                "Title / subject name",
                "Date & location",
                "Uniform & medium",
                "Photographer (if listed)",
              ].map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <h3 className="text-sm font-semibold text-gray-700">Storage note</h3>
            <p className="mt-1.5 text-xs text-gray-500">
              Run history is saved to <code className="font-mono bg-gray-200 px-1 rounded">localStorage</code> in your browser. Backend persistence coming in a future sprint.
            </p>
          </div>
        </div>
      </div>

      {/* DELETE CONFIRM MODAL */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900">Delete this run?</h3>
            <p className="mt-2 text-sm text-gray-500">
              This will remove the run from local storage. This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      <MetadataReviewPopup
        images={images}
        isOpen={openReview}
        onClose={() => setOpenReview(false)}
      />
    </div>
  );
}