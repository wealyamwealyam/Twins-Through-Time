import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

import MetadataReviewPopup from "../components/MetadataPopup";
import OnboardingSubmitModal from "../components/OnboardingSubmitModal";
import { apiRequest, getBackendSession } from "../utils/apiClient";
import { createOnboardingRequest, getOnboardingRequests, submitOnboardingRequest } from "../services/onboardingRequestService";

function StatusBadge({ status }) {
  const styles = {
    queued: "bg-yellow-100 text-yellow-800",
    running: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-700",
  };
  const label = status.replace("_", " ");

  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${styles[status] ?? "bg-gray-100 text-gray-700"}`}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.oneOf(["queued", "running", "completed", "failed", "cancelled"]).isRequired,
};

export default function Upload() {
  const [url, setUrl] = useState("");
  const [maxPhotos, setMaxPhotos] = useState(50);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [errorDetails, setErrorDetails] = useState(null);
  const [reviewImages, setReviewImages] = useState([]);
  const [reviewPhotoIds, setReviewPhotoIds] = useState([]);
  const [reviewMessage, setReviewMessage] = useState("");
  const [openReview, setOpenReview] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingSuccessBanner, setOnboardingSuccessBanner] = useState(false);
  // Map of scrapeJobId → onboarding request (for runs that already have one)
  const [requestByJobId, setRequestByJobId] = useState({});
  // Tracks which job is currently being submitted so we can update the map after
  const pendingJobIdRef = useRef(null);

  const images = [
    { id: "1", src: `${import.meta.env.BASE_URL}DemoPictures/Grenville-M.-Dodge.jpg`, fileName: "Grenville-M.-Dodge.jpg" },
    { id: "2", src: `${import.meta.env.BASE_URL}DemoPictures/oldguy.jpg`, fileName: "oldguy.jpg" },
    { id: "3", src: `${import.meta.env.BASE_URL}DemoPictures/youngkid.jpg`, fileName: "youngkid.jpg" },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      if (!getBackendSession()?.token) {
        setLoadingRuns(false);
        return;
      }

      try {
        const [result, requestsData, photosData] = await Promise.all([
          apiRequest("/scrape-jobs"),
          getOnboardingRequests({ limit: 100 }).catch(() => null),
          apiRequest("/photos?limit=500").catch(() => null),
        ]);
        if (!cancelled) {
          setRuns(result?.data || []);

          // Build photoId → scrapeJobId from all photos
          const photoToJob = {};
          for (const photo of photosData?.data || []) {
            if (photo.scrapeJobId) photoToJob[photo.id] = photo.scrapeJobId;
          }

          // Build scrapeJobId → onboarding request
          const map = {};
          for (const req of requestsData?.data || []) {
            for (const pid of req.photoIds || []) {
              const jid = photoToJob[pid];
              if (jid && !map[jid]) map[jid] = req;
            }
          }
          setRequestByJobId(map);
        }
      } catch (error) {
        if (!cancelled) {
          setError(error?.message || "Unable to load scrape runs.");
        }
      } finally {
        if (!cancelled) {
          setLoadingRuns(false);
        }
      }
    }

    loadRuns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runs.some((run) => ["queued", "running"].includes(run.status))) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      if (!getBackendSession()?.token) return;

      try {
        const result = await apiRequest("/scrape-jobs");
        setRuns(result?.data || []);
      } catch (error) {
        setError(error?.message || "Unable to refresh scrape runs.");
      }
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [runs]);

  function isValidUrl(str) {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!getBackendSession()?.token) {
      setError("Please sign in before starting a scrape.");
      return;
    }

    if (!url.trim()) {
      setError("Please enter a URL.");
      return;
    }

    if (!isValidUrl(url.trim())) {
      setError("That does not look like a valid URL. Make sure it starts with https://");
      return;
    }

    const max = Number(maxPhotos);
    if (!Number.isInteger(max) || max < 1 || max > 500) {
      setError("Max photos must be between 1 and 500.");
      return;
    }

    setSubmitting(true);

    try {
      const newRun = await apiRequest("/scrape-jobs", {
        method: "POST",
        body: JSON.stringify({
          url: url.trim(),
          maxPhotos: max,
        }),
      });

      setRuns((prev) => [newRun, ...prev]);
      setUrl("");
      setMaxPhotos(50);
    } catch (error) {
      setError(error?.message || "Unable to start scrape.");
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDelete(id) {
    setDeleteId(id);
  }

  async function handleDelete() {
    const id = deleteId;
    setDeleteId(null);

    try {
      await apiRequest(`/scrape-jobs/${id}`, { method: "DELETE" });
      setRuns((prev) =>
        prev.map((run) =>
          run.id === id
            ? { ...run, status: "cancelled", completedAt: new Date().toISOString() }
            : run
        )
      );
    } catch (error) {
      setError(error?.message || "Unable to cancel scrape run.");
    }
  }

  async function showErrorDetails(run) {
    try {
      const job = await apiRequest(`/scrape-jobs/${run.id}`);
      setErrorDetails({
        id: job.id,
        url: job.url,
        status: job.status,
        message: job.errorMessage || run.errorMessage || "No backend error detail is available for this job.",
      });
    } catch (error) {
      setErrorDetails({
        id: run.id,
        url: run.url,
        status: run.status,
        message: error?.message || "Unable to load scrape job error details.",
      });
    }
  }

  async function openBackendReview(run) {
    setReviewMessage("");
    setOnboardingSuccessBanner(false);

    try {
      const result = await apiRequest(`/photos?scrapeJobId=${encodeURIComponent(run.id)}&limit=100`);
      const photos = result?.data || [];

      if (photos.length === 0) {
        setReviewMessage("This scrape completed, but no photos were created for review.");
        return;
      }

      // Mark all fetched photos as "reviewed" so they are eligible for onboarding
      await Promise.allSettled(
        photos.map((photo) =>
          apiRequest(`/photos/${photo.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "reviewed" }),
          })
        )
      );

      const ids = photos.map((p) => p.id);
      setReviewPhotoIds(ids);
      setReviewImages(
        photos.map((photo) => ({
          id: photo.id,
          src: photo.imageUrl,
          fileName: photo.imageUrl?.split("/").pop() || photo.id,
          name: photo.name || "",
          photoNotes: photo.photoNotes || "",
        }))
      );
      setOpenReview(true);
    } catch (error) {
      setReviewMessage(error?.message || "Unable to load scraped photos.");
    }
  }

  async function savePhotoMetadata(annotation) {
    await apiRequest(`/photos/${annotation.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: annotation.metadata.name || null,
        age: annotation.metadata.ageRange === "Unknown" ? null : annotation.metadata.ageRange,
        regiment: annotation.metadata.affiliation === "Unknown" ? null : annotation.metadata.affiliation,
        photoNotes: annotation.metadata.notes || null,
        tags: [
          annotation.metadata.race,
          annotation.metadata.sex,
          ...Object.entries(annotation.metadata.accessories)
            .filter(([, enabled]) => enabled)
            .map(([key]) => key),
        ].filter((tag) => tag && tag !== "Unknown"),
      }),
    });
  }

async function handleOnboardingSubmit(title, notes) {
  const created = await createOnboardingRequest({
    title,
    notes,
    photoIds: reviewPhotoIds,
  });

  const submitted = await submitOnboardingRequest(created.id);

  setOpenReview(false);
  setShowOnboardingModal(false);
  setReviewImages([]);
  setReviewPhotoIds([]);
  setOnboardingSuccessBanner(true);

  if (pendingJobIdRef.current && created) {
    setRequestByJobId((prev) => ({
      ...prev,
      [pendingJobIdRef.current]: {
        ...created,
        status: submitted.status,
      },
    }));
    pendingJobIdRef.current = null;
  }
}
  

  async function openDirectOnboarding(run) {
    setReviewMessage("");
    setOnboardingSuccessBanner(false);
    pendingJobIdRef.current = run.id;

    try {
      const result = await apiRequest(`/photos?scrapeJobId=${encodeURIComponent(run.id)}&limit=100`);
      const photos = result?.data || [];

      if (photos.length === 0) {
        setReviewMessage("This scrape completed, but no photos were found to submit.");
        return;
      }

      // Mark all photos as "reviewed" so they pass the onboarding requirement
      await Promise.allSettled(
        photos.map((photo) =>
          apiRequest(`/photos/${photo.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "reviewed" }),
          })
        )
      );

      setReviewPhotoIds(photos.map((p) => p.id));
      setShowOnboardingModal(true);
    } catch (err) {
      setReviewMessage(err?.message || "Unable to load photos for this run.");
    }
  }

  function formatDate(iso) {
    if (!iso) return "Unknown date";

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
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Upload</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Paste a Civil War photo archive URL to begin scraping images and metadata.
        </p>
      </div>

      {onboardingSuccessBanner ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Onboarding request submitted!</p>
            <p className="text-xs text-green-700">An admin will review your photos and metadata.</p>
          </div>
          <button
            type="button"
            onClick={() => setOnboardingSuccessBanner(false)}
            className="text-green-600 hover:text-green-800 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
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
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                  }}
                  placeholder="https://example.com/civil-war-photos"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                />
                {error ? (
                  <p className="mt-1.5 text-xs text-red-600 font-medium">{error}</p>
                ) : null}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Max photos <span className="text-gray-400 font-normal">(1-500)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={maxPhotos}
                  onChange={(e) => setMaxPhotos(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {submitting ? "Scraping..." : "Start scrape"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUrl("");
                    setMaxPhotos(50);
                    setError("");
                  }}
                  className="text-sm font-medium text-gray-500 hover:text-gray-900 transition"
                >
                  Clear
                </button>
              </div>
            </form>

            <button
              type="button"
              onClick={() => setOpenReview(true)}
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Demo scrape
            </button>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Scrape runs
                {runs.length > 0 ? (
                  <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {runs.length}
                  </span>
                ) : null}
              </h2>
            </div>

            {loadingRuns ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-900">Loading scrape runs...</p>
              </div>
            ) : runs.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                <p className="text-sm font-semibold text-gray-900">No runs yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Paste a URL above to kick off your first scrape.
                </p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-gray-100">
                {reviewMessage ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                    {reviewMessage}
                  </div>
                ) : null}
                {runs.map((run) => (
                  <div key={run.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">
                          {run.url}
                        </span>
                        <StatusBadge status={run.status} />
                      </div>

                      <p className="mt-0.5 text-xs text-gray-400 truncate">Job {run.id}</p>

                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span>{formatDate(run.createdAt)}</span>
                        <span>|</span>
                        <span>{run.photoCount ?? 0} photos</span>
                        <span>|</span>
                        <span>Max {run.maxPhotos}</span>
                      </div>
                      {run.status === "failed" && run.errorMessage ? (
                        <p className="mt-2 text-xs font-medium text-red-600">
                          {run.errorMessage}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {run.status === "completed" ? (
                        requestByJobId[run.id] ? (
                          /* ── Already submitted ── */
                          <span className="flex items-center gap-1 text-xs font-semibold text-indigo-700">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Submitted
                          </span>
                        ) : (
                          /* ── Not yet submitted ── */
                          <>
                            <button
                              type="button"
                              onClick={() => openDirectOnboarding(run)}
                              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition"
                            >
                              Submit
                            </button>
                            <button
                              type="button"
                              onClick={() => openBackendReview(run)}
                              className="text-xs font-semibold text-gray-900 hover:underline"
                            >
                              Review →
                            </button>
                          </>
                        )
                      ) : null}
                      {["queued", "running"].includes(run.status) ? (
                        <button
                          type="button"
                          onClick={() => confirmDelete(run.id)}
                          className="text-xs text-gray-400 hover:text-red-500 transition font-medium"
                        >
                          Cancel
                        </button>
                      ) : null}
                      {run.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => showErrorDetails(run)}
                          className="text-xs font-semibold text-red-700 hover:underline"
                        >
                          View error
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

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
              ].map((source) => (
                <li key={source} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  {source}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900">What gets captured</h3>
            <ul className="mt-3 space-y-1.5 text-xs text-gray-600">
              {[
                "Image URL and thumbnail",
                "Title or subject name",
                "Date and location",
                "Uniform and medium",
                "Photographer if listed",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <h3 className="text-sm font-semibold text-gray-700">Storage note</h3>
            <p className="mt-1.5 text-xs text-gray-500">
              Run history is loaded from the backend scrape job queue for the signed-in user.
            </p>
          </div>
        </div>
      </div>

      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900">Cancel this run?</h3>
            <p className="mt-2 text-sm text-gray-500">
              Only queued or running scrape jobs can be cancelled.
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
              >
                Keep run
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition"
              >
                Cancel run
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {errorDetails ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-lg mx-4">
            <h3 className="text-base font-semibold text-gray-900">Scrape error</h3>
            <p className="mt-2 text-sm text-gray-500 break-all">{errorDetails.url}</p>
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorDetails.message}
            </div>
            <p className="mt-3 text-xs text-gray-500">Job {errorDetails.id}</p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setErrorDetails(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MetadataReviewPopup
        images={reviewImages.length > 0 ? reviewImages : images}
        isOpen={openReview}
        onClose={() => {
          setOpenReview(false);
          setReviewImages([]);
          setReviewPhotoIds([]);
        }}
        onSave={reviewImages.length > 0 ? savePhotoMetadata : undefined}
        onOnboardingSubmit={
          reviewPhotoIds.length > 0
            ? () => setShowOnboardingModal(true)
            : undefined
        }
      />

      <OnboardingSubmitModal
        isOpen={showOnboardingModal}
        photoCount={reviewPhotoIds.length}
        onSubmit={handleOnboardingSubmit}
        onClose={() => setShowOnboardingModal(false)}
      />
    </div>
  );
}
