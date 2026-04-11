import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import HistoryHeader from "../components/HistoryHeader";
import { apiRequest, getBackendSession } from "../utils/apiClient";
import { getOnboardingRequests } from "../services/onboardingRequestService";

function formatDate(iso) {
  if (!iso) return "Unknown date";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function folderName(job) {
  try {
    return new URL(job.url).hostname;
  } catch {
    return "Scrape job";
  }
}

export default function History() {
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  // Map of photoId → onboarding request, built after both loads
  const [requestByPhotoId, setRequestByPhotoId] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      if (!getBackendSession()?.token) {
        setMessage("Sign in to view scraped photo history.");
        setIsLoading(false);
        return;
      }

      try {
        const [result, requestsData, photosData] = await Promise.all([
          apiRequest("/scrape-jobs?limit=100"),
          getOnboardingRequests({ limit: 100 }).catch(() => null),
          apiRequest("/photos?limit=500").catch(() => null),
        ]);
        if (!cancelled) {
          setJobs(result?.data || []);

          // Build photoId → scrapeJobId lookup from all user photos
          const photoToJob = {};
          for (const photo of photosData?.data || []) {
            if (photo.scrapeJobId) photoToJob[photo.id] = photo.scrapeJobId;
          }

          // Build scrapeJobId → onboarding request lookup
          const map = {};
          for (const req of requestsData?.data || []) {
            for (const pid of req.photoIds || []) {
              const jid = photoToJob[pid];
              if (jid && !map[jid]) map[jid] = req;
            }
          }
          setRequestByPhotoId(map);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error?.message || "Unable to load scrape history.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadJobs();

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleJobs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return jobs;

    return jobs.filter((job) =>
      [job.url, job.status, folderName(job)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [jobs, query]);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <HistoryHeader
        title="Scrape History"
        subtitle="Open a scrape folder to review the photos created by that run"
        onSearchChange={setQuery}
      />

      {message ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
          {message}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
          Loading scrape folders...
        </div>
      ) : null}

      {!isLoading && !message && visibleJobs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">No scrape folders found</p>
          <p className="mt-2 text-sm text-gray-600">
            Complete a scrape from the Upload page, then its folder will appear here.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {visibleJobs.map((job) => (
          <Link
            key={job.id}
            to={`/history/${job.id}`}
            className="group rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:bg-gray-50 hover:shadow-md"
          >
            <div className="flex h-24 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
              <div className="relative h-14 w-20 rounded-md bg-gray-900">
                <div className="absolute -top-2 left-2 h-4 w-9 rounded-t-md bg-gray-700" />
              </div>
            </div>

            <div className="mt-4 min-w-0">
              <div className="truncate text-sm font-semibold text-gray-900">
                {folderName(job)}
              </div>
              <div className="mt-1 truncate text-xs text-gray-500">
                {formatDate(job.createdAt)}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold text-gray-700">{job.photoCount ?? 0} photos</span>
                <span className={`rounded-full border px-2 py-0.5 font-semibold ${
                  job.status === "completed"
                    ? "bg-green-100 border-green-200 text-green-700"
                    : job.status === "queued"
                    ? "bg-yellow-100 border-yellow-200 text-yellow-700"
                    : "bg-gray-50 border-gray-200 text-gray-600"
                }`}>
                  {job.status}
                </span>
              </div>
              {requestByPhotoId[job.id] ? (
                <div className="mt-2 flex items-center gap-1.5">
                  <svg className="h-3 w-3 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs font-semibold text-indigo-700">
                    Onboarding request submitted
                  </span>
                </div>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
