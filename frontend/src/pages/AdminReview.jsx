import { useEffect, useMemo, useState } from "react";

import AdminSectionNav from "../components/AdminSectionNav";
import { apiRequest } from "../utils/apiClient";
import {
  getOnboardingRequests,
  getOnboardingRequest,
  assignOnboardingReviewer,
  approveOnboardingRequest,
  rejectOnboardingRequest,
} from "../services/onboardingRequestService";
import MetadataReviewPopup from "../components/MetadataPopup";
import ConfidenceBadge from "../components/ConfidenceBadge";
import { readConfidence, getConfidenceStatus } from "../utils/confidenceUtils";
import { deriveMetadataForReview } from "../utils/photoMetadata";

/*helper for image editing*/
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

function formatDateTime(iso) {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    under_review: "bg-blue-100 text-blue-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-700"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function ImageModal({ request, onClose, onEdit }) {
  if (!request) return null;

  const photos = request.photos || [];
  const flaggedCount = photos.filter(
    (p) => getConfidenceStatus(readConfidence(deriveMetadataForReview(p))) === "flagged"
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {request.onboardingRequestTitle}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {photos.length} submitted image{photos.length === 1 ? "" : "s"}
              {flaggedCount > 0 ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {flaggedCount} flagged
                </span>
              ) : null}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          {photos.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((photo) => {
                const score = readConfidence(deriveMetadataForReview(photo));
                const isFlagged = getConfidenceStatus(score) === "flagged";

                return (
                  <article
                    key={photo.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm ${
                      isFlagged ? "border-red-300 ring-1 ring-red-200" : "border-gray-200"
                    }`}
                  >
                    <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                      <img
                        src={photo.imageUrl}
                        alt={photo.name || photo.id}
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="mt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-gray-900">
                            {photo.name || "Unidentified photo"}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {photo.status || "No status"}
                          </div>
                        </div>
                        <ConfidenceBadge score={score} size="sm" showLabel={false} />
                      </div>

                      {isFlagged ? (
                        <p className="mt-2 text-xs font-semibold text-red-700">
                          AI confidence below 55% — review metadata before approval.
                        </p>
                      ) : null}

                      {photo.photoNotes ? (
                        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          {photo.photoNotes}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => onEdit(photo)}
                        className="mt-3 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 transition"
                      >
                        Edit metadata
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center text-sm text-gray-600">
              No submitted images found for this request.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AdminReview() {
  const [requests, setRequests] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [detailRequest, setDetailRequest] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [reviewImages, setReviewImages] = useState([]);
  const [openReview, setOpenReview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setMessage("");

      try {
        const [requestResult, adminUsersResult, allUsersResult] = await Promise.all([
          getOnboardingRequests({ limit: 100 }),
          apiRequest("/admin/users?accountType=admin&limit=100"),
          apiRequest("/admin/users?limit=100"),
        ]);

        if (cancelled) return;

        const adminList = adminUsersResult?.data || [];
        const allUsers = allUsersResult?.data || [];

        const map = {};
        for (const user of allUsers) {
          map[user.id] = user;
        }

        setRequests(requestResult?.data || []);
        setAdmins(adminList);
        setUsersById(map);
      } catch (error) {
        if (!cancelled) {
          setRequests([]);
          setAdmins([]);
          setUsersById({});
          setMessage(error?.message || "Unable to load review queue.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  function getUserLabel(id) {
    if (!id) return "Unassigned";
    const user = usersById[id];
    if (!user) return id;
    return user.username || user.email || id;
  }

  const filteredRequests = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return [...requests]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .filter((request) => {
        const matchesStatus =
          statusFilter === "all" || request.status === statusFilter;

        const matchesSearch =
          !needle ||
          request.onboardingRequestTitle?.toLowerCase().includes(needle) ||
          request.id?.toLowerCase().includes(needle) ||
          getUserLabel(request.submittedBy).toLowerCase().includes(needle);

        return matchesStatus && matchesSearch;
      });
  }, [requests, statusFilter, search, usersById]);

  function updateLocalRequest(id, updates) {
    setRequests((current) =>
      current.map((request) =>
        request.id === id ? { ...request, ...updates } : request
      )
    );
  }

  async function handleAssign(requestId, reviewerId) {
    if (!reviewerId) return;

    setActionId(requestId);
    setMessage("");

    try {
      const updated = await assignOnboardingReviewer(requestId, reviewerId);
      updateLocalRequest(requestId, {
        reviewerId: updated.reviewerId,
        updatedAt: updated.updatedAt,
      });
      setMessage("Reviewer assigned.");
    } catch (error) {
      setMessage(error?.message || "Unable to assign reviewer.");
    } finally {
      setActionId("");
    }
  }

  async function handleApprove(requestId) {
    setActionId(requestId);
    setMessage("");

    try {
      const updated = await approveOnboardingRequest(requestId);

      updateLocalRequest(requestId, {
        status: updated.status,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt,
      });

      setMessage("Request approved.");
    } catch (error) {
      setMessage(error?.message || "Unable to approve request.");
    } finally {
      setActionId("");
    }
  }

  async function handleReject(requestId) {
    setActionId(requestId);
    setMessage("");

    try {
      const updated = await rejectOnboardingRequest(requestId);

      updateLocalRequest(requestId, {
        status: updated.status,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt,
      });

      setMessage("Request rejected.");
    } catch (error) {
      setMessage(error?.message || "Unable to reject request.");
    } finally {
      setActionId("");
    }
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

  setDetailRequest((current) => {
    if (!current) return current;

    return {
      ...current,
      photos: current.photos.map((photo) =>
        photo.id === updated.id ? updated : photo
      ),
    };
  });
}

async function openRequestImages(requestId) {
  setIsLoadingDetail(true);
  setMessage("");

  try {
    const detail = await getOnboardingRequest(requestId);
    setDetailRequest(detail);
  } catch (error) {
    setMessage(error?.message || "Unable to load submitted images.");
  } finally {
    setIsLoadingDetail(false);
  }
}




  const counts = {
    all: requests.length,
    under_review: requests.filter((r) => r.status === "under_review").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    pending: requests.filter((r) => r.status === "pending").length,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Review queue
            </h1>
            <p className="mt-3 text-base text-gray-600">
              Review submitted onboarding requests, inspect their images, and approve or reject them.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <AdminSectionNav />
      </div>

      {message ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-700 shadow-sm">
          {message}
        </div>
      ) : null}

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="md:col-span-2">
            <div className="text-sm font-semibold text-gray-900">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, request ID, or submitter"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            />
          </label>

          <label>
            <div className="text-sm font-semibold text-gray-900">Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">All statuses</option>
              <option value="under_review">Under review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="pending">Pending</option>
            </select>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ["all", "All", counts.all],
            ["under_review", "Under review", counts.under_review],
            ["approved", "Approved", counts.approved],
            ["rejected", "Rejected", counts.rejected],
            ["pending", "Pending", counts.pending],
          ].map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                statusFilter === value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200",
              ].join(" ")}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
            <div className="text-base font-semibold text-gray-900">
              Loading review queue...
            </div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
            <div className="text-base font-semibold text-gray-900">
              No requests found
            </div>
            <div className="mt-2 text-sm text-gray-500">
              There are no onboarding requests for this filter right now.
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredRequests.map((request) => {
              const isWorking = actionId === request.id;
              const canApprove = request.status === "under_review";
              const canReject =
                request.status === "pending" || request.status === "under_review";

              return (
                <article key={request.id} className="rounded-2xl border border-gray-200 p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-3">
                          <h2 className="text-lg font-semibold text-gray-900">
                            {request.onboardingRequestTitle}
                          </h2>
                          <StatusBadge status={request.status} />
                        </div>

                        <div className="mt-2 text-sm text-gray-600">
                          Request {request.id}
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          Submitted by {getUserLabel(request.submittedBy)} • {request.photoCount || request.photoIds?.length || 0} photos
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          Created {formatDateTime(request.createdAt)} • Reviewer: {getUserLabel(request.reviewerId)}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openRequestImages(request.id)}
                          disabled={isLoadingDetail}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
                        >
                          View submitted images
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900">
                          Assign reviewer
                        </label>
                        <select
                          value={request.reviewerId || ""}
                          onChange={(e) => handleAssign(request.id, e.target.value)}
                          disabled={isWorking}
                          className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10 disabled:opacity-60"
                        >
                          <option value="">Unassigned</option>
                          {admins.map((admin) => (
                            <option key={admin.id} value={admin.id}>
                              {admin.username}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        <button
                          type="button"
                          onClick={() => handleApprove(request.id)}
                          disabled={!canApprove || isWorking}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isWorking && canApprove ? "Working..." : "Approve"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReject(request.id)}
                          disabled={!canReject || isWorking}
                          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                        >
                          {isWorking && canReject ? "Working..." : "Reject"}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <MetadataReviewPopup
        images={reviewImages}
        isOpen={openReview}
        onClose={() => {
        setOpenReview(false);
        setReviewImages([]);
      }}
      onSave={savePhotoMetadata}
      />
      <ImageModal
        request={detailRequest}
        onClose={() => setDetailRequest(null)}
        onEdit={(photo) => {
          setDetailRequest(null);
          setReviewImages([toReviewImage(photo)]);
          setOpenReview(true);
        }}
      />
    </div>
  );
}