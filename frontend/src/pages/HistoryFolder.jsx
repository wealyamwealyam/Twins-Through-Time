import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import DownloadDropdown from "../components/DownloadDropdown";
import MetadataReviewPopup from "../components/MetadataPopup";
import Record from "../components/Record";
import { apiRequest, getBackendSession } from "../utils/apiClient";
import {
  CONFIDENCE_THRESHOLD,
  readConfidence,
  getConfidenceStatus,
} from "../utils/confidenceUtils";
import { deriveMetadataForReview } from "../utils/photoMetadata";
import {
  deleteScrapePhotos,
  downloadScrapePhotos,
} from "../services/scrapePhotoService";

function toReviewImage(photo) {
  return {
    id: photo.id,
    src: photo.imageUrl,
    fileName: photo.imageUrl?.split("/").pop() || photo.id,
    name: photo.name || "",
    photoNotes: photo.photoNotes || "",
    scrapedMetadata: deriveMetadataForReview(photo),
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
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [openReview, setOpenReview] = useState(false);
  const [reviewInitialIndex, setReviewInitialIndex] = useState(0);
  const [reviewInitialPhotoId, setReviewInitialPhotoId] = useState(null);
  const [reviewSession, setReviewSession] = useState(0);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [downloading, setDownloading] = useState("");
  const [deleting, setDeleting] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadFolder() {
      if (!getBackendSession()?.token) {
        setMessage("Sign in to view this scrape folder.");
        setIsLoading(false);
        return;
      }

      try {
        const [jobData, photosData] = await Promise.all([
          apiRequest(`/scrape-jobs/${jobId}`),
          apiRequest(`/photos?scrapeJobId=${encodeURIComponent(jobId)}&limit=100`),
        ]);

        if (!cancelled) {
          setJob(jobData);
          setPhotos(photosData?.data || []);
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

  const displayedPhotos = photos;
  const reviewImages = useMemo(
    () => displayedPhotos.map((photo) => toReviewImage(photo)),
    [displayedPhotos]
  );

  function openPhotoReview(photoId, photoIndex) {
    setReviewInitialPhotoId(photoId);
    setReviewInitialIndex(photoIndex);
    setReviewSession((current) => current + 1);
    setOpenReview(true);
  }

  function photoConfidenceStatus(photo) {
    return getConfidenceStatus(readConfidence(deriveMetadataForReview(photo)));
  }

  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const flaggedPhotos = photos.filter((photo) => photoConfidenceStatus(photo) === "flagged");
  const passedPhotos = photos.filter((photo) => photoConfidenceStatus(photo) === "passed");

  function togglePhotoSelection(photoId, checked) {
    setSelectedPhotoIds((current) =>
      checked
        ? Array.from(new Set([...current, photoId]))
        : current.filter((id) => id !== photoId)
    );
  }

  async function handleDownload(filter, ids = []) {
    setActionMessage("");
    setActionError("");
    setDownloading(filter);

    try {
      await downloadScrapePhotos(jobId, filter, ids);
      setActionMessage("Download started.");
    } catch (error) {
      setActionError(error?.message || "Unable to download photos.");
    } finally {
      setDownloading("");
    }
  }

  async function handleDelete(filter, ids = []) {
    setActionMessage("");
    setActionError("");

    const countByFilter = {
      selected: ids.length,
      flagged: flaggedPhotos.length,
      passed: passedPhotos.length,
    };
    const count = countByFilter[filter] ?? 0;

    if (count === 0) return;

    const messages = {
      selected: `Delete ${count} selected photo${count === 1 ? "" : "s"} from this scrape? This cannot be undone.`,
      flagged: `Delete ${count} flagged photo${count === 1 ? "" : "s"} from this scrape? This cannot be undone.`,
      passed: `Delete ${count} passed photo${count === 1 ? "" : "s"} from this scrape? This cannot be undone.`,
    };

    if (!window.confirm(messages[filter])) return;

    setDeleting(filter);

    try {
      const result = await deleteScrapePhotos(jobId, filter, ids);
      const deletedIds = new Set(result?.deletedIds || ids);

      if (filter === "flagged") {
        for (const photo of flaggedPhotos) deletedIds.add(photo.id);
      }
      if (filter === "passed") {
        for (const photo of passedPhotos) deletedIds.add(photo.id);
      }

      setPhotos((current) => current.filter((photo) => !deletedIds.has(photo.id)));
      setSelectedPhotoIds((current) => current.filter((id) => !deletedIds.has(id)));
      setOpenReview(false);

      if (result?.scrapeJobDeleted || result?.remainingPhotoCount === 0) {
        navigate("/history", { replace: true });
        return;
      }

      setJob((current) =>
        current
          ? {
              ...current,
              photoCount:
                result?.remainingPhotoCount ??
                Math.max(
                  0,
                  (current.photoCount ?? photos.length) -
                    (result?.deletedCount ?? deletedIds.size)
                ),
            }
          : current
      );
      setActionMessage(`Deleted ${result?.deletedCount ?? deletedIds.size} photo${(result?.deletedCount ?? deletedIds.size) === 1 ? "" : "s"}.`);
    } catch (error) {
      setActionError(error?.message || "Unable to delete photos.");
    } finally {
      setDeleting("");
    }
  }

  async function savePhotoMetadata(annotation) {
    const metadata = annotation.metadata || {};
    const updated = await apiRequest(`/photos/${annotation.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        metadata,
        name:
          [metadata["First Name"], metadata["Middle Name or Initial"], metadata["Last Name"]]
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

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <Link to="/history" className="text-sm font-semibold text-gray-700 hover:underline">
          &lt;- Back to folders
        </Link>

        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{folderName(job)}</h1>
            <p className="mt-2 break-all text-sm text-gray-500">
              {job?.url || "Loading scrape URL..."}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {job
                ? `${formatDate(job.createdAt)} | ${job.photoCount ?? 0} photos`
                : "Loading folder details..."}
            </p>
          </div>

          {job ? (
            <div className="flex flex-col items-end gap-3">
              <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                {job.status}
              </span>

              {photos.length > 0 ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-xs font-semibold text-gray-600">
                    {selectedPhotoIds.length} selected
                  </span>
                  <DownloadDropdown
                    label="Download"
                    busy={Boolean(downloading)}
                    options={[
                      {
                        value: "all",
                        label: "Download all photos",
                        onClick: () => handleDownload("all"),
                      },
                      {
                        value: "passed",
                        label: "Download passed photos",
                        onClick: () => handleDownload("passed"),
                      },
                      {
                        value: "flagged",
                        label: "Download flagged photos",
                        onClick: () => handleDownload("flagged"),
                      },
                      {
                        value: "selected",
                        label: "Download selected photos",
                        disabled: selectedPhotoIds.length === 0,
                        onClick: () => handleDownload("selected", selectedPhotoIds),
                      },
                    ]}
                  />
                  <button
                    type="button"
                    disabled={flaggedPhotos.length === 0 || Boolean(deleting)}
                    onClick={() => handleDelete("flagged")}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting === "flagged" ? "Deleting..." : "Auto-delete flagged photos"}
                  </button>
                  <button
                    type="button"
                    disabled={passedPhotos.length === 0 || Boolean(deleting)}
                    onClick={() => handleDelete("passed")}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting === "passed" ? "Deleting..." : "Delete passed photos"}
                  </button>
                  <button
                    type="button"
                    disabled={selectedPhotoIds.length === 0 || Boolean(deleting)}
                    onClick={() => handleDelete("selected", selectedPhotoIds)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting === "selected" ? "Deleting..." : "Delete selected photos"}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {actionMessage ? (
        <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-800">
          {actionMessage}
        </div>
      ) : null}

      {actionError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {actionError}
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

      {photos.length > 0
        ? (() => {
            const flaggedCount = photos.filter(
              (p) =>
                photoConfidenceStatus(p) === "flagged"
            ).length;

            if (flaggedCount === 0) return null;

            return (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
                <svg
                  className="h-5 w-5 shrink-0 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  />
                </svg>
                <div>
                  <p className="font-semibold">
                    {flaggedCount} of {photos.length} photo{photos.length === 1 ? "" : "s"} flagged for manual review
                  </p>
                  <p className="mt-0.5 text-xs">
                    AI confidence below {Math.round(CONFIDENCE_THRESHOLD * 100)}%. Open each flagged record and update its metadata.
                  </p>
                </div>
              </div>
            );
          })()
        : null}

      <div className="mt-6 grid gap-4">
        {displayedPhotos.map((photo, index) => (
          <Record
            key={photo.id}
            imageSrc={photo.imageUrl}
            imageAlt={photo.name || "Scraped historical photo"}
            title={photo.name || "Unidentified photo"}
            subtitle={photo.regiment || photo.collection || "Scraped record"}
            date={photo.dateTaken || ""}
            location={photo.location || ""}
            traits={toTraits(photo)}
            confidenceScore={readConfidence(deriveMetadataForReview(photo))}
            selected={selectedSet.has(photo.id)}
            onSelectChange={(checked) => togglePhotoSelection(photo.id, checked)}
            actionSlot={
              <>
                <button
                  type="button"
                  disabled={Boolean(downloading)}
                  onClick={() => handleDownload("selected", [photo.id])}
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Download
                </button>
                <button
                  type="button"
                  disabled={Boolean(deleting)}
                  onClick={() => handleDelete("selected", [photo.id])}
                  className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            }
            onClick={() => openPhotoReview(photo.id, index)}
          />
        ))}
      </div>

      <MetadataReviewPopup
        key={reviewSession}
        images={reviewImages}
        initialIndex={reviewInitialIndex}
        initialImageId={reviewInitialPhotoId}
        isOpen={openReview}
        onClose={() => {
          setOpenReview(false);
          setReviewInitialIndex(0);
          setReviewInitialPhotoId(null);
        }}
        onSave={savePhotoMetadata}
      />
    </div>
  );
}
