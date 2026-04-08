import { useMemo, useState } from "react";

import AdminSectionNav from "../components/AdminSectionNav";

const initialRequests = [
  {
    id: "REQ-104",
    title: "Library of Congress batch 18",
    submittedBy: "mrivera",
    status: "under_review",
    reviewerId: "Dana Holt",
    photoCount: 27,
    updatedAt: "Mar 21, 2026",
  },
  {
    id: "REQ-106",
    title: "Virginia archive portraits",
    submittedBy: "bporter",
    status: "pending",
    reviewerId: "Unassigned",
    photoCount: 12,
    updatedAt: "Mar 22, 2026",
  },
  {
    id: "REQ-109",
    title: "Getty officer collection",
    submittedBy: "rlee",
    status: "approved",
    reviewerId: "Nina Ops",
    photoCount: 31,
    updatedAt: "Mar 19, 2026",
  },
];

export default function AdminReview() {
  const [requests, setRequests] = useState(initialRequests);
  const [statusFilter, setStatusFilter] = useState("all");

  const visibleRequests = useMemo(() => {
    if (statusFilter === "all") {
      return requests;
    }

    return requests.filter((request) => request.status === statusFilter);
  }, [requests, statusFilter]);

  function cycleStatus(id) {
    setRequests((current) =>
      current.map((request) => {
        if (request.id !== id) {
          return request;
        }

        if (request.status === "pending") {
          return { ...request, status: "under_review", reviewerId: "Dana Holt" };
        }

        if (request.status === "under_review") {
          return { ...request, status: "approved" };
        }

        return { ...request, status: "pending", reviewerId: "Unassigned" };
      })
    );
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
              Admin view for onboarding requests. This screen is aligned to the
              documented statuses: pending, under review, approved, rejected, and onboarded.
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
            </select>
          </label>
        </div>
      </section>

      <div className="mt-6">
        <AdminSectionNav />
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4">
            {visibleRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-gray-200 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold text-gray-900">{request.title}</h2>
                      <StatusBadge status={request.status} />
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      {request.id} • Submitted by {request.submittedBy} • {request.photoCount} photos
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      Reviewer: {request.reviewerId} • Updated {request.updatedAt}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => cycleStatus(request.id)}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    Advance status
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Workflow notes</h2>
            <ul className="mt-4 grid gap-3 text-sm text-gray-600">
              <li>Pending requests should be assignable to an admin reviewer.</li>
              <li>Under-review requests can be approved or rejected with an admin note.</li>
              <li>Approved requests can later trigger the CWS bridge onboarding flow.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Next backend hookups</h2>
            <ul className="mt-4 grid gap-2 text-sm text-gray-600">
              <li>`GET /onboarding-requests` with admin filters</li>
              <li>`PATCH /onboarding-requests/:id/assign` for reviewer assignment</li>
              <li>`POST /onboarding-requests/:id/approve` and reject flows</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
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
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}
