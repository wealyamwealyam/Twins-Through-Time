import { useEffect, useState } from "react";
import PropTypes from "prop-types";

/**
 * OnboardingSubmitModal
 * ----------------------
 * Modal that collects a title + optional description before submitting
 * a set of reviewed photos as an onboarding request.
 *
 * Props:
 *   isOpen      - boolean, controls visibility
 *   photoCount  - number of photos being submitted
 *   onSubmit    - async (title, notes) => void  — called when user confirms
 *   onClose     - () => void                    — called on cancel / after success
 */
export default function OnboardingSubmitModal({
  isOpen,
  photoCount,
  onSubmit,
  onClose,
  initialTitle = "",
  initialNotes = "",
  submitLabel = "Submit request",
  onDelete = null, // async () => void — when provided, shows "Delete request" in edit mode
}) {
  const [title, setTitle] = useState(initialTitle);
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // When the modal opens, sync fields with the initial values (supports edit mode)
  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setNotes(initialNotes);
      setStatus("idle");
      setErrorMsg("");
      setShowDeleteConfirm(false);
      setDeleting(false);
    }
  }, [isOpen, initialTitle, initialNotes]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      await onSubmit(title.trim(), notes.trim() || null);
      setStatus("success");
    } catch (err) {
      setErrorMsg(err?.message || "Unable to submit onboarding request. Please try again.");
      setStatus("error");
    }
  }

  function handleClose() {
    // Reset state before closing so next open starts fresh
    setTitle("");
    setNotes("");
    setStatus("idle");
    setErrorMsg("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200">

        {/* ── Header ── */}
        <div className="border-b px-6 py-4">
          <h2 className="text-base font-semibold text-gray-900">{submitLabel === "Save changes" ? "Edit onboarding request" : "Submit for onboarding"}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {photoCount} {photoCount === 1 ? "photo" : "photos"} will be included in this request.
          </p>
        </div>

        {status === "success" ? (
          /* ── Success state ── */
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-900">Request submitted!</p>
            <p className="mt-1 text-sm text-gray-500">
              An admin will review your photos and metadata.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 transition"
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-4">

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Request title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                  placeholder="e.g. Union soldiers from Gettysburg collection"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                  disabled={status === "submitting"}
                />
                <p className="mt-1 text-right text-xs text-gray-400">{title.length}/255</p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Description <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Add any additional context, source information, or notes for the reviewer..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition resize-none"
                  disabled={status === "submitting"}
                />
                <p className="mt-1 text-right text-xs text-gray-400">{notes.length}/2000</p>
              </div>

              {/* Photo count badge */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-gray-600">
                  <span className="font-semibold text-gray-900">{photoCount}</span>{" "}
                  {photoCount === 1 ? "photo" : "photos"} from this scrape job will be submitted
                </span>
              </div>

              {/* Error message */}
              {status === "error" && errorMsg ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMsg}
                </div>
              ) : null}
            </div>

            {/* ── Footer ── */}
            <div className="border-t px-6 py-4">
              {showDeleteConfirm ? (
                /* ── Delete confirmation inline ── */
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-gray-700 font-medium">
                    Delete this onboarding request? This cannot be undone.
                  </p>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition"
                    >
                      Keep it
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={async () => {
                        setDeleting(true);
                        try {
                          await onDelete();
                        } finally {
                          setDeleting(false);
                        }
                      }}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition"
                    >
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal footer ── */
                <div className="flex items-center gap-3">
                  {onDelete ? (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={status === "submitting"}
                      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 bg-white hover:bg-red-50 disabled:opacity-50 transition mr-auto"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0a1 1 0 00-1-1h-4a1 1 0 00-1 1m-4 0h10" />
                      </svg>
                      Delete request
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={status === "submitting"}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || status === "submitting"}
                    className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {status === "submitting" ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      submitLabel
                    )}
                  </button>
                </div>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

OnboardingSubmitModal.propTypes = {
  isOpen:       PropTypes.bool.isRequired,
  photoCount:   PropTypes.number.isRequired,
  onSubmit:     PropTypes.func.isRequired,
  onClose:      PropTypes.func.isRequired,
  initialTitle: PropTypes.string,
  initialNotes: PropTypes.string,
  submitLabel:  PropTypes.string,
  onDelete:     PropTypes.func,
};
