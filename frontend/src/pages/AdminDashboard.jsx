import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import PropTypes from "prop-types";

import AdminSectionNav from "../components/AdminSectionNav";
import { apiRequest } from "../utils/apiClient";

const reviewQueue = [
  {
    id: "REQ-104",
    title: "Library of Congress batch 18",
    submittedBy: "mrivera",
    status: "Under review",
    photos: 27,
    reviewer: "Dana Holt",
  },
  {
    id: "REQ-106",
    title: "Virginia archive portraits",
    submittedBy: "bporter",
    status: "Pending",
    photos: 12,
    reviewer: "Unassigned",
  },
  {
    id: "REQ-109",
    title: "Getty officer collection",
    submittedBy: "rlee",
    status: "Pending",
    photos: 31,
    reviewer: "Unassigned",
  },
];

const recentAdminActions = [
  "Invite link generated for a new admin reviewer",
  "Two onboarding requests approved and pushed to the bridge service",
  "One contributor account deactivated after duplicate signup",
];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setMessage("");

      try {
        const result = await apiRequest("/admin/dashboard/stats");
        if (!cancelled) {
          setStats(result);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error?.message || "Unable to load admin dashboard stats.");
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

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
      label: "Pending requests",
      value: stats?.pendingRequests ?? "-",
      note: "Onboarding requests under review",
    },
    {
      label: "Onboarded photos",
      value: stats?.onboardedPhotos ?? "-",
      note: "Photos in onboarded requests",
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
              Monitor users, review onboarding submissions, and manage the approval
              flow planned in the project API.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuickAction
              to="/admin/users"
              title="Manage users"
              desc="Search roles, inspect activity, and deactivate accounts."
            />
            <QuickAction
              to="/admin/review"
              title="Open review queue"
              desc="Assign reviewers and move requests through approval."
            />
            <QuickAction
              to="/admin/onboarding"
              title="Run onboarding"
              desc="Process approved batches and push them into the final onboarding pipeline."
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

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Review queue snapshot</h2>
              <p className="mt-1 text-sm text-gray-500">
                Mock data for the future onboarding request workflow.
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
                </tr>
              </thead>
              <tbody>
                {reviewQueue.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-4">
                      <div className="font-semibold text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.id}</div>
                    </td>
                    <td className="py-4 text-gray-700">{item.submittedBy}</td>
                    <td className="py-4 text-gray-700">{item.photos}</td>
                    <td className="py-4 text-gray-700">{item.reviewer}</td>
                    <td className="py-4">
                      <StatusPill status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Recent admin actions</h2>
            <ul className="mt-4 grid gap-3">
              {recentAdminActions.map((item) => (
                <li key={item} className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Planned API mapping</h2>
            <ul className="mt-4 grid gap-2 text-sm text-gray-600">
              <li>`GET /admin/dashboard/stats` for top-level cards</li>
              <li>`GET /admin/users` for directory and filters</li>
              <li>`PATCH /admin/users/:id/deactivate` for account actions</li>
              <li>`POST /admin/invite-link` for reviewer invites</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

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

function StatusPill({ status }) {
  const tone =
    status === "Pending"
      ? "bg-amber-100 text-amber-800"
      : "bg-blue-100 text-blue-800";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

StatusPill.propTypes = {
  status: PropTypes.string.isRequired,
};
