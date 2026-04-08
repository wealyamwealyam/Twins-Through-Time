import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import { apiRequest, getBackendSession } from "../utils/apiClient";

export function Home() {
  const steps = [
    {
      title: "Paste a link",
      desc: "Add a Civil War photo page URL on the Upload page.",
    },
    {
      title: "Scrape images and metadata",
      desc: "The backend creates scrape jobs and photo records.",
    },
    {
      title: "Review results",
      desc: "Open completed runs and correct metadata before approval.",
    },
    {
      title: "Track history",
      desc: "Browse scraped photos and reopen metadata review later.",
    },
  ];

  const [health, setHealth] = useState(null);
  const [runs, setRuns] = useState([]);
  const [photoCount, setPhotoCount] = useState(0);
  const [message, setMessage] = useState("");
  const hasBackendSession = Boolean(getBackendSession()?.token);

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      try {
        const healthData = await apiRequest("/health", { skipAuth: true });
        if (!cancelled) {
          setHealth(healthData);
        }

        if (!getBackendSession()?.token) return;

        const [jobsData, photosData] = await Promise.all([
          apiRequest("/scrape-jobs?limit=5"),
          apiRequest("/photos?limit=1"),
        ]);

        if (!cancelled) {
          setRuns(jobsData?.data || []);
          setPhotoCount(photosData?.total || 0);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error?.message || "Unable to load backend status.");
        }
      }
    }

    loadHomeData();

    return () => {
      cancelled = true;
    };
  }, []);

  const systemStatus = useMemo(() => {
    const running = runs.filter((run) => run.status === "running").length;
    const queued = runs.filter((run) => run.status === "queued").length;
    const lastCompleted = runs.find((run) => run.status === "completed");

    return {
      scraper: {
        label: health?.status === "ok" ? "Live" : "Offline",
        value: health?.status === "ok" ? "Online" : "Unavailable",
      },
      queue: {
        label: hasBackendSession ? "Backend" : "Sign in",
        value: hasBackendSession ? `${running} running | ${queued} queued` : "Sign in to load queue",
      },
      lastRun: {
        label: hasBackendSession ? "Backend" : "Sign in",
        value: lastCompleted
          ? new Date(lastCompleted.completedAt || lastCompleted.updatedAt).toLocaleString()
          : "No completed runs",
      },
    };
  }, [health, hasBackendSession, runs]);

  const recentRuns = runs.map((run) => ({
    id: run.id,
    title: run.url,
    date: new Date(run.createdAt).toLocaleString(),
    source: new URL(run.url).hostname,
    imagesFound: run.photoCount ?? 0,
    flagged: 0,
    status: run.status,
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
              Twins Through Time
            </h1>
            <p className="mt-3 text-gray-600 text-base md:text-lg">
              Scrape Civil War photo pages, verify results with a human reviewer,
              and keep corrected metadata connected to the backend.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/upload"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                Start a new scrape
              </Link>

              <Link
                to="/history"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
              >
                View scraped photos
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              {hasBackendSession ? `${photoCount} scraped photos available for review` : "Sign in to load your scrape activity"}
            </div>
          </div>

          <div className="w-full md:w-[360px] rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Project status</h2>

            <div className="mt-4 grid gap-3">
              <StatusRow
                title="Scraper"
                label={systemStatus.scraper.label}
                value={systemStatus.scraper.value}
              />
              <StatusRow
                title="Queue"
                label={systemStatus.queue.label}
                value={systemStatus.queue.value}
              />
              <StatusRow
                title="Last successful run"
                label={systemStatus.lastRun.label}
                value={systemStatus.lastRun.value}
              />
            </div>

            <div className="mt-4 text-xs text-gray-500">
              {message || "Status comes from the backend health and scrape job APIs."}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-gray-900">How it works</h2>
          <Link to="/upload" className="text-sm font-medium text-gray-900 hover:underline">
            Go to Upload -&gt;
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, idx) => (
            <div
              key={step.title}
              className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5"
            >
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
            <Link to="/history" className="text-sm font-medium text-gray-900 hover:underline">
              See all -&gt;
            </Link>
          </div>

          {recentRuns.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm font-semibold text-gray-900">No runs yet</p>
              <p className="mt-2 text-sm text-gray-600">
                Start by adding a link on the Upload page. Recent backend scrape jobs will appear here.
              </p>
              <div className="mt-5">
                <Link
                  to="/upload"
                  className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
                >
                  Start a new scrape
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-gray-100">
              {recentRuns.map((run) => (
                <div key={run.id} className="py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{run.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {run.date} | {run.source}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {run.imagesFound} images | {run.flagged} flagged
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-900">
                    {run.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>

          <div className="mt-4 grid gap-3">
            <QuickCard
              title="Upload"
              desc="Paste a link to begin scraping and metadata capture."
              to="/upload"
            />
            <QuickCard
              title="History"
              desc="Review scraped photos and update metadata."
              to="/history"
            />
            <QuickCard
              title="Profile"
              desc="Manage account details and role requests."
              to="/profile"
            />
          </div>
        </div>
      </section>

      <section className="mt-8 mb-6 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Key notes</h2>
        <ul className="mt-3 grid gap-2 text-sm text-gray-600 list-disc pl-5">
          <li>Human review helps reduce false positives and improve metadata confidence.</li>
          <li>Source support works best with static pages that expose direct image URLs.</li>
          <li>Scraped photos and metadata review now load from the backend.</li>
        </ul>
      </section>
    </div>
  );
}

function StatusRow({ title, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-xs font-semibold text-gray-700">{title}</div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700 font-semibold">
          {label}
        </span>
        <span className="text-xs font-semibold text-gray-900">{value}</span>
      </div>
    </div>
  );
}

StatusRow.propTypes = {
  title: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

function QuickCard({ title, desc, to }) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 transition p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="mt-1 text-sm text-gray-600">{desc}</div>
        </div>
        <div className="text-sm font-semibold text-gray-900 group-hover:translate-x-0.5 transition">
          -&gt;
        </div>
      </div>
    </Link>
  );
}

QuickCard.propTypes = {
  title: PropTypes.string.isRequired,
  desc: PropTypes.string.isRequired,
  to: PropTypes.string.isRequired,
};
