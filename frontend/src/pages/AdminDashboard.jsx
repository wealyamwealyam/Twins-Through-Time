import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import AdminSectionNav from "../components/AdminSectionNav";
import { apiRequest } from "../utils/apiClient";
import { getOnboardingRequests } from "../services/onboardingRequestService";

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

function StatusPill({ status }) {
  const tone =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800"
      : status === "under_review"
      ? "bg-blue-100 text-blue-800"
      : status === "rejected"
      ? "bg-red-100 text-red-800"
      : "bg-amber-100 text-amber-800";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

StatusPill.propTypes = {
  status: PropTypes.string.isRequired,
};

function QuickAction({ to, title, desc }) {
  return (
    <Link to={to} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 transition hover:bg-gray-100">
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{desc}</div>
    </Link>
  );
}

QuickAction.propTypes = {
  to: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  desc: PropTypes.string.isRequired,
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setMessage("");

      try {
        const [statsResult, requestsResult, usersResult] = await Promise.all([
          apiRequest("/admin/dashboard/stats"),
          getOnboardingRequests({ limit: 100 }),
          apiRequest("/admin/users?limit=100"),
        ]);

        if (cancelled) return;

        const userMap = {};
        for (const user of usersResult?.data || []) {
          userMap[user.id] = user;
        }

        setStats(statsResult);
        setRequests(requestsResult?.data || []);
        setUsersById(userMap);
      } catch (error) {
        if (!cancelled) {
          setMessage(error?.message || "Unable to load admin dashboard.");
        }
      }
    }

    loadDashboard();

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

  const latestRequests = useMemo(() => {
    return [...requests]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);
  }, [requests]);

  const statCards = [
    {
      label: "Total users",
      value: stats?.totalUsers ?? "-",
      note: "Current backend accounts",
    },
    {
      label: "Scrape jobs",
      value: stats?.totalScrapeJobs ?? "-",
      note: "Total scrape jobs in the database",
    },
    {
      label: "Pending review",
      value: stats?.pendingRequests ?? "-",
      note: "Requests currently under review",
    },
    {
      label: "Approved requests",
      value: stats?.approvedRequests ?? "-",
      note: "Requests approved in Supabase",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
              Admin workspace
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
              Admin dashboard
            </h1>
            <p className="mt-3 text-base text-gray-600">
              Monitor the system, review onboarding requests, and manage users.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAction
              to="/admin/users"
              title="Manage users"
              desc="Search accounts, update roles, and moderate access."
            />
            <QuickAction
              to="/admin/review"
              title="Open review queue"
              desc="Inspect submitted images and approve or reject requests."
            />
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

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-600">{stat.label}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{stat.value}</div>
            <div className="mt-3 text-xs text-gray-500">{stat.note}</div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Latest onboarding requests</h2>
            <p className="mt-1 text-sm text-gray-500">
              Most recent requests from the real backend.
            </p>
          </div>
          <Link to="/admin/review" className="text-sm font-semibold text-gray-900 hover:underline">
            View full queue
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="pb-3 font-semibold">Request</th>
                <th className="pb-3 font-semibold">Submitted by</th>
                <th className="pb-3 font-semibold">Photos</th>
                <th className="pb-3 font-semibold">Reviewer</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {latestRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                    No onboarding requests yet.
                  </td>
                </tr>
              ) : (
                latestRequests.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-4">
                      <div className="font-semibold text-gray-900">{item.onboardingRequestTitle}</div>
                      <div className="text-xs text-gray-500">{item.id}</div>
                    </td>
                    <td className="py-4 text-gray-700">{getUserLabel(item.submittedBy)}</td>
                    <td className="py-4 text-gray-700">{item.photoCount || item.photoIds?.length || 0}</td>
                    <td className="py-4 text-gray-700">{getUserLabel(item.reviewerId)}</td>
                    <td className="py-4">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="py-4 text-gray-700">{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}