import { useMemo, useState } from "react";
import PropTypes from "prop-types";

import AdminSectionNav from "../components/AdminSectionNav";

const initialBatches = [
  {
    id: "ONB-301",
    title: "Library of Congress batch 18",
    source: "Library of Congress",
    submittedBy: "mrivera",
    assignee: "Dana Holt",
    photoCount: 27,
    reviewStatus: "approved",
    onboardingStatus: "ready",
    metadataScore: 92,
    updatedAt: "Mar 24, 2026",
  },
  {
    id: "ONB-302",
    title: "Virginia archive portraits",
    source: "Virginia State Archive",
    submittedBy: "bporter",
    assignee: "Unassigned",
    photoCount: 12,
    reviewStatus: "approved",
    onboardingStatus: "needs_revision",
    metadataScore: 68,
    updatedAt: "Mar 23, 2026",
  },
  {
    id: "ONB-303",
    title: "Getty officer collection",
    source: "Getty Civil War collection",
    submittedBy: "rlee",
    assignee: "Nina Ops",
    photoCount: 31,
    reviewStatus: "approved",
    onboardingStatus: "sent",
    metadataScore: 88,
    updatedAt: "Mar 22, 2026",
  },
  {
    id: "ONB-304",
    title: "Smithsonian portraits batch 4",
    source: "Smithsonian Archives",
    submittedBy: "ksingh",
    assignee: "Dana Holt",
    photoCount: 19,
    reviewStatus: "approved",
    onboardingStatus: "onboarded",
    metadataScore: 96,
    updatedAt: "Mar 20, 2026",
  },
];

export default function AdminOnboarding() {
  const [batches, setBatches] = useState(initialBatches);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");

  const visibleBatches = useMemo(() => {
    return batches.filter((batch) => {
      const matchesStatus =
        statusFilter === "all" || batch.onboardingStatus === statusFilter;

      const matchesSource =
        sourceFilter === "all" || batch.source === sourceFilter;

      const matchesSearch =
        search.trim() === "" ||
        batch.title.toLowerCase().includes(search.toLowerCase()) ||
        batch.id.toLowerCase().includes(search.toLowerCase()) ||
        batch.submittedBy.toLowerCase().includes(search.toLowerCase());

      return matchesStatus && matchesSource && matchesSearch;
    });
  }, [batches, statusFilter, sourceFilter, search]);

  function assignToMe(id) {
    setBatches((current) =>
      current.map((batch) =>
        batch.id === id
          ? { ...batch, assignee: "Current Admin", updatedAt: "Just now" }
          : batch
      )
    );
  }

  function advanceStatus(id) {
    setBatches((current) =>
      current.map((batch) => {
        if (batch.id !== id) return batch;

        if (batch.onboardingStatus === "needs_revision") {
          return {
            ...batch,
            onboardingStatus: "ready",
            updatedAt: "Just now",
          };
        }

        if (batch.onboardingStatus === "ready") {
          return {
            ...batch,
            onboardingStatus: "sent",
            updatedAt: "Just now",
          };
        }

        if (batch.onboardingStatus === "sent") {
          return {
            ...batch,
            onboardingStatus: "onboarded",
            updatedAt: "Just now",
          };
        }

        return batch;
      })
    );
  }

  const summary = {
    ready: batches.filter((batch) => batch.onboardingStatus === "ready").length,
    needsRevision: batches.filter((batch) => batch.onboardingStatus === "needs_revision").length,
    sent: batches.filter((batch) => batch.onboardingStatus === "sent").length,
    onboarded: batches.filter((batch) => batch.onboardingStatus === "onboarded").length,
  };

  return (
    <div className="mx-auto max-w-6xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Onboarding operations
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">
              Admin onboarding
            </h1>
            <p className="mt-3 text-base text-gray-600">
              Process approved archive batches, verify metadata readiness, assign
              operational ownership, and move requests into the final onboarding
              pipeline.
            </p>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
            Approved requests from the review queue should appear here before
            they are sent to the bridge service.
          </div>
        </div>
      </section>

      <div className="mt-6">
        <AdminSectionNav />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Ready to send"
          value={summary.ready}
          note="Approved and operationally ready"
        />
        <SummaryCard
          label="Needs revision"
          value={summary.needsRevision}
          note="Metadata or QA checks still missing"
        />
        <SummaryCard
          label="Sent to bridge"
          value={summary.sent}
          note="Submitted to downstream onboarding service"
        />
        <SummaryCard
          label="Onboarded"
          value={summary.onboarded}
          note="Completed and available in the system"
        />
      </section>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="md:col-span-2">
            <div className="text-sm font-semibold text-gray-900">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, batch ID, or submitter"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            />
          </label>

          <label>
            <div className="text-sm font-semibold text-gray-900">Onboarding status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">All statuses</option>
              <option value="needs_revision">Needs revision</option>
              <option value="ready">Ready</option>
              <option value="sent">Sent</option>
              <option value="onboarded">Onboarded</option>
            </select>
          </label>

          <label>
            <div className="text-sm font-semibold text-gray-900">Source</div>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">All sources</option>
              <option value="Library of Congress">Library of Congress</option>
              <option value="Virginia State Archive">Virginia State Archive</option>
              <option value="Getty Civil War collection">Getty Civil War collection</option>
              <option value="Smithsonian Archives">Smithsonian Archives</option>
            </select>
          </label>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Onboarding batches
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Approved requests waiting for operational processing.
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {visibleBatches.length} visible batch{visibleBatches.length === 1 ? "" : "es"}
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {visibleBatches.map((batch) => (
              <article
                key={batch.id}
                className="rounded-2xl border border-gray-200 p-5"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {batch.title}
                      </h3>
                      <StatusBadge status={batch.onboardingStatus} />
                    </div>

                    <div className="mt-2 text-sm text-gray-600">
                      {batch.id} • {batch.source} • Submitted by {batch.submittedBy}
                    </div>

                    <div className="mt-1 text-sm text-gray-500">
                      Assignee: {batch.assignee} • {batch.photoCount} photos • Updated {batch.updatedAt}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <InfoTile label="Review status" value="Approved" />
                      <InfoTile
                        label="Metadata completeness"
                        value={`${batch.metadataScore}%`}
                      />
                      <InfoTile
                        label="Recommended action"
                        value={getRecommendedAction(batch)}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:w-[250px] xl:justify-end">
                    <button
                      type="button"
                      onClick={() => assignToMe(batch.id)}
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Assign to me
                    </button>

                    <button
                      type="button"
                      onClick={() => advanceStatus(batch.id)}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                    >
                      Advance onboarding
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {visibleBatches.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
                <div className="text-base font-semibold text-gray-900">
                  No onboarding batches found
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Adjust the filters or wait for approved requests to enter onboarding.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Onboarding checklist
            </h2>
            <ul className="mt-4 grid gap-3 text-sm text-gray-600">
              <li>Confirm the request was approved in the review queue.</li>
              <li>Verify title, date, location, and archive source metadata.</li>
              <li>Check that image count matches the expected batch total.</li>
              <li>Assign an admin owner before sending downstream.</li>
              <li>Mark the request as onboarded after the bridge confirms success.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Planned backend hookups
            </h2>
            <ul className="mt-4 grid gap-2 text-sm text-gray-600">
              <li>`GET /admin/onboarding` for approved onboarding batches</li>
              <li>`PATCH /admin/onboarding/:id/assign` for ownership</li>
              <li>`PATCH /admin/onboarding/:id/status` for readiness updates</li>
              <li>`POST /admin/onboarding/:id/send` to trigger bridge flow</li>
              <li>`POST /admin/onboarding/:id/complete` after successful import</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, note }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-semibold text-gray-600">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
        {value}
      </div>
      <div className="mt-3 text-xs text-gray-500">{note}</div>
    </div>
  );
}

SummaryCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.number.isRequired,
  note: PropTypes.string.isRequired,
};

function InfoTile({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}

InfoTile.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

function StatusBadge({ status }) {
  const styles = {
    needs_revision: "bg-amber-100 text-amber-800",
    ready: "bg-blue-100 text-blue-800",
    sent: "bg-violet-100 text-violet-800",
    onboarded: "bg-emerald-100 text-emerald-800",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

StatusBadge.propTypes = {
  status: PropTypes.oneOf(["needs_revision", "ready", "sent", "onboarded"]).isRequired,
};

function getRecommendedAction(batch) {
  if (batch.onboardingStatus === "needs_revision") {
    return "Fix metadata";
  }

  if (batch.onboardingStatus === "ready") {
    return "Send to bridge";
  }

  if (batch.onboardingStatus === "sent") {
    return "Await confirmation";
  }

  return "No action needed";
}
