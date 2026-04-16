import { useEffect, useMemo, useState } from "react";

import AdminSectionNav from "../components/AdminSectionNav";
import { apiRequest } from "../utils/apiClient";
import {
  getOnboardingRequests,
  assignOnboardingReviewer,
  approveOnboardingRequest,
  rejectOnboardingRequest,
} from "../services/onboardingRequestService";

function formatDate(iso) {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-100 text-amber-800",
    under_review: "bg-blue-100 text-blue-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    onboarded: "bg-violet-100 text-violet-800",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-700"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function AdminReview() {
  const [requests, setRequests] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [actionId, setActionId] = useState("");
  const [adminNotes, setAdminNotes] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      setMessage("");

      try {
        const requestParams = { limit: 100 };
        if (statusFilter !== "all") {
          requestParams.status = statusFilter;
        }

        const [requestResult, adminUsersResult, allUsersResult] = await Promise.all([
          getOnboardingRequests(requestParams),
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
  }, [statusFilter]);

  const visibleRequests = useMemo(() => requests, [requests]);

  function getUserLabel(id) {
    if (!id) return "Unassigned";
    const user = usersById[id];
    if (!user) return id;
    return user.username || user.email || id;
  }

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
      const updated = await approveOnboardingRequest(
        requestId,
        adminNotes[requestId] || ""
      );

      updateLocalRequest(requestId, {
        status: updated.status,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt,
        adminNote: updated.adminNote,
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
      const updated = await rejectOnboardingRequest(
        requestId,
        adminNotes[requestId] || ""
      );

      updateLocalRequest(requestId, {
        status: updated.status,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt,
        adminNote: updated.adminNote,
      });

      setMessage("Request rejected.");
    } catch (error) {
      setMessage(error?.message || "Unable to reject request.");
    } finally {
      setActionId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Review queue
            </h1>
            <p className="mt-3 text-base text-gray-600">
              Review real onboarding requests, assign admins, and approve or reject submissions.
            </p>
          </div>

          <label>
            <div className="text-sm font-semibold text-gray-900">Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="onboarded">Onboarded</option>
            </select>
          </label>
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

      <section className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {isLoading ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <div className="text-base font-semibold text-gray-900">
                Loading review queue...
              </div>
            </div>
          ) : visibleRequests.length === 0 ? (
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
              {visibleRequests.map((request) => {
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
                            Reviewer: {getUserLabel(request.reviewerId)} • Updated {formatDate(request.updatedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
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

                        <div>
                          <label className="block text-sm font-semibold text-gray-900">
                            Admin note
                          </label>
                          <textarea
                            value={adminNotes[request.id] || ""}
                            onChange={(e) =>
                              setAdminNotes((current) => ({
                                ...current,
                                [request.id]: e.target.value,
                              }))
                            }
                            placeholder="Optional approval/rejection note"
                            className="mt-2 min-h-[88px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
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
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Workflow notes</h2>
            <ul className="mt-4 grid gap-3 text-sm text-gray-600">
              <li>Requests must reach under_review before they can be approved.</li>
              <li>Assigning a reviewer is optional but useful for ownership.</li>
              <li>Rejected requests can include an admin note for feedback.</li>
              <li>Approved requests will later feed the onboarding operations page.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Connected backend</h2>
            <ul className="mt-4 grid gap-2 text-sm text-gray-600">
              <li>`GET /onboarding-requests`</li>
              <li>`PATCH /onboarding-requests/:id/assign`</li>
              <li>`POST /onboarding-requests/:id/approve`</li>
              <li>`POST /onboarding-requests/:id/reject`</li>
              <li>`GET /admin/users?accountType=admin`</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}