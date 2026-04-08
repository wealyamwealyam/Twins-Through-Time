import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";

import MetadataReviewPopup from "../components/MetadataPopup";
import Record from "../components/Record";
import { apiRequest, getBackendSession } from "../utils/apiClient";

function toReviewImage(photo) {
  return {
    id: photo.id,
    src: photo.imageUrl,
    fileName: photo.imageUrl?.split("/").pop() || photo.id,
    name: photo.name || "",
    photoNotes: photo.photoNotes || "",
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

  function openPhotoReview(photo) {
    setReviewImages([toReviewImage(photo)]);
    setOpenReview(true);
  }

  async function savePhotoMetadata(annotation) {
    const updated = await apiRequest(`/photos/${annotation.id}`, {
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
            <p className="mt-2 break-all text-sm text-gray-500">{job?.url || "Loading scrape URL..."}</p>
            <p className="mt-2 text-sm text-gray-600">
              {job ? `${formatDate(job.createdAt)} | ${job.photoCount ?? 0} photos` : "Loading folder details..."}
            </p>
          </div>

          {job ? (
            <span className="rounded-full border bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              {job.status}
            </span>
          ) : null}
        </div>
      </div>

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
    </div>
  );
}
