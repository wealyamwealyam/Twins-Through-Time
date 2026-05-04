import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import PropTypes from "prop-types";

import AdminSectionNav from "../components/AdminSectionNav";
import { apiRequest } from "../utils/apiClient";

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
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setMessage("");

      try {
        const statsResult = await apiRequest("/admin/dashboard/stats");

        if (!cancelled) {
          setStats(statsResult);
        }
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
      label: "Scraped photos",
      value: stats?.totalPhotos ?? "-",
      note: "Photo records available for review and management",
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
              Monitor the system and manage backend users.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <QuickAction
              to="/admin/users"
              title="Manage users"
              desc="Search accounts, update roles, and moderate access."
            />
            <QuickAction
              to="/history"
              title="Scrape history"
              desc="Open scrape folders and review collected photos."
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

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-gray-600">{stat.label}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{stat.value}</div>
            <div className="mt-3 text-xs text-gray-500">{stat.note}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
