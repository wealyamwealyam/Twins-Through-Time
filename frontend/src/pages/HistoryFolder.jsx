import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import MetadataReviewPopup from "../components/MetadataPopup";
import OnboardingSubmitModal from "../components/OnboardingSubmitModal";
import Record from "../components/Record";
import { apiRequest, getBackendSession } from "../utils/apiClient";
import {
  createOnboardingRequest,
  getOnboardingRequests,
  updateOnboardingRequest,
  deleteOnboardingRequest,
  submitOnboardingRequest,
} from "../services/onboardingRequestService";

function toReviewImage(photo) {
  return {
    id: photo.id,
    src: photo.imageUrl,
    fileName: photo.imageUrl?.split("/").pop() || photo.id,
    name: photo.name || "",
    photoNotes: photo.photoNotes || "",
    scrapedMetadata: photo.scrapedMetadata || photo.metadataJson || {},
  };
}

function toTraits(photo) {
  return [
    photo.regiment ? { label: "Regiment", value: photo.regiment } : null,
    photo.collection ? { label: "Collection", value: photo.collection } : null,
    photo.status ? { label: "Status", value: photo.status.replace("_", " ") } : null,
    ...(photo.tags || []),
  ].filter(Boolean);
}

function folderName(job) {
  if (!job?.url) return "Scrape folder";

  try {
    return new URL(job.url).hostname;
  } catch {
    return "Scrape folder";
  }
}

function formatDate(iso) {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleString();
}

export default function HistoryFolder() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [reviewImages, setReviewImages] = useState([]);
  const [openReview, setOpenReview] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingSuccessBanner, setOnboardingSuccessBanner] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  // Existing onboarding request for this job (null = none, object = found)
  const [existingRequest, setExistingRequest] = useState(null);
  // Whether the edit modal is open (re-uses OnboardingSubmitModal)
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFolder() {
      if (!getBackendSession()?.token) {
        setMessage("Sign in to view this scrape folder.");
        setIsLoading(false);
        return;
      }

      try {
        const [jobData, photosData, requestsData] = await Promise.all([
          apiRequest(`/scrape-jobs/${jobId}`),
          apiRequest(`/photos?scrapeJobId=${encodeURIComponent(jobId)}&limit=100`),
          getOnboardingRequests({ limit: 100 }).catch(() => null),
        ]);

        if (!cancelled) {
          const fetchedPhotos = photosData?.data || [];
          setJob(jobData);
          setPhotos(fetchedPhotos);

          // Find an onboarding request whose photoIds overlap with this job's photos
          const photoIdSet = new Set(fetchedPhotos.map((p) => p.id));
          const match = (requestsData?.data || []).find((r) =>
            r.photoIds?.some((pid) => photoIdSet.has(pid))
          );
          setExistingRequest(match ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error?.message || "Unable to load this scrape folder.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadFolder();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  function openPhotoReview(photo) {
    setReviewImages([toReviewImage(photo)]);
    setOpenReview(true);
  }

  async function savePhotoMetadata(annotation) {
    const metadata = annotation.metadata || {};
    const updated = await apiRequest(`/photos/${annotation.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: [metadata["First Name"], metadata["Middle Name or Initial"], metadata["Last Name"]]
          .filter(Boolean)
          .join(" ") || null,
        age: metadata.Age || null,
        regiment: metadata["Military Unit"] || null,
        dateTaken: metadata["Year Born"] || null,
        photoNotes: JSON.stringify(metadata),
      }),
    });

    setPhotos((current) =>
      current.map((photo) => (photo.id === updated.id ? updated : photo))
    );
  }

  async function openDirectOnboarding() {
    setOnboardingError("");
    setOnboardingSuccessBanner(false);

    try {
      // Mark every photo in this job as "reviewed" so the backend accepts them
      await Promise.allSettled(
        photos.map((photo) =>
          apiRequest(`/photos/${photo.id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: "reviewed" }),
          })
        )
      );
      setShowOnboardingModal(true);
    } catch (err) {
      setOnboardingError(err?.message || "Unable to prepare photos for submission.");
    }
  }

  async function handleOnboardingSubmit(title, notes) {
  const created = await createOnboardingRequest({
    title,
    notes,
    photoIds: photos.map((p) => p.id),
  });

  const submitted = await submitOnboardingRequest(created.id);

  setExistingRequest({
    ...created,
    status: submitted.status,
  });
  setShowOnboardingModal(false);
  setOnboardingSuccessBanner(true);
}

  async function handleOnboardingEdit(title, notes) {
    const updated = await updateOnboardingRequest(existingRequest.id, { title, notes });
    setExistingRequest(updated);
    setShowEditModal(false);
    setOnboardingSuccessBanner(true);
  }

async function handleOnboardingDelete() {
  await deleteOnboardingRequest(existingRequest.id);
  setExistingRequest(null);
  setShowEditModal(false);
  setOnboardingSuccessBanner(false);
}

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <Link to="/history" className="text-sm font-semibold text-gray-700 hover:underline">
          &lt;- Back to folders
        </Link>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{folderName(job)}</h1>
            <p className="mt-2 break-all text-sm text-gray-500">{job?.url || "Loading scrape URL..."}</p>
            <p className="mt-2 text-sm text-gray-600">
              {job ? `${formatDate(job.createdAt)} | ${job.photoCount ?? 0} photos` : "Loading folder details..."}
            </p>
          </div>

          {job ? (
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                {job.status}
              </span>
              {job.status === "completed" && photos.length > 0 ? (
                existingRequest ? (
                  /* ── Request already submitted ── */
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Onboarding request submitted
                    </span>
                    {existingRequest.status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => setShowEditModal(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
                        </svg>
                        Edit request
                      </button>
                    ) : (
                      <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-800 capitalize">
                        {existingRequest.status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                ) : (
                  /* ── No request yet ── */
                  <button
                    type="button"
                    onClick={openDirectOnboarding}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Create onboarding request
                  </button>
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {onboardingSuccessBanner ? (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <svg className="h-5 w-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Onboarding request submitted!</p>
            <p className="text-xs text-green-700">An admin will review your photos and metadata.</p>
          </div>
          <button type="button" onClick={() => setOnboardingSuccessBanner(false)} className="text-green-600 hover:text-green-800 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : null}

      {onboardingError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {onboardingError}
        </div>
      ) : null}

      {message ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
          Loading folder photos...
        </div>
      ) : null}

      {!isLoading && !message && photos.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">No photos in this folder</p>
          <p className="mt-2 text-sm text-gray-600">
            This scrape completed without creating photo records.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {photos.map((photo) => (
          <Record
            key={photo.id}
            imageSrc={photo.imageUrl}
            imageAlt={photo.name || "Scraped historical photo"}
            title={photo.name || "Unidentified photo"}
            subtitle={photo.regiment || photo.collection || "Scraped record"}
            date={photo.dateTaken || ""}
            location={photo.location || ""}
            traits={toTraits(photo)}
            onClick={() => openPhotoReview(photo)}
          />
        ))}
      </div>

      <MetadataReviewPopup
        images={reviewImages}
        isOpen={openReview}
        onClose={() => {
          setOpenReview(false);
          setReviewImages([]);
        }}
        onSave={savePhotoMetadata}
      />

      <OnboardingSubmitModal
        isOpen={showOnboardingModal}
        photoCount={photos.length}
        onSubmit={handleOnboardingSubmit}
        onClose={() => setShowOnboardingModal(false)}
      />

      {/* Edit modal — pre-fills existing title/notes */}
      <OnboardingSubmitModal
        isOpen={showEditModal}
        photoCount={photos.length}
        initialTitle={existingRequest?.onboardingRequestTitle ?? ""}
        initialNotes={existingRequest?.onboardingRequestNotes ?? ""}
        submitLabel="Save changes"
        onSubmit={handleOnboardingEdit}
        onClose={() => setShowEditModal(false)}
        onDelete={handleOnboardingDelete}
      />
    </div>
  );
}
