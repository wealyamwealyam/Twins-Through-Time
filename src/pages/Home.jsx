
import { Link } from "react-router-dom";

export function Home() {
  const steps = [
    {
      title: "Paste a link",
      desc: "Add a Civil War photo page URL on the Upload page.",
    },
    {
      title: "Scrape images + metadata",
      desc: "Backend collects image URLs and metadata fields for review.",
    },
    {
      title: "Human-in-the-loop verification",
      desc: "Flag false positives and confirm metadata accuracy.",
    },
    {
      title: "Review & archive",
      desc: "Reopen past runs, track decisions, and export later (coming soon).",
    },
  ];

  // Placeholder data (wire to backend later)
  const systemStatus = {
    scraper: { label: "Mock", value: "Online" },
    queue: { label: "Mock", value: "0 running • 0 pending" },
    lastRun: { label: "Mock", value: "—" },
  };

  const recentRuns = []; // empty-state for now

  return (
    <div className="max-w-6xl mx-auto">
      {/* HERO */}
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
              Twins Through Time
            </h1>
            <p className="mt-3 text-gray-600 text-base md:text-lg">
              Scrape Civil War photo pages, verify results with a human-in-the-loop,
              and review metadata for accuracy.
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
                View past runs
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Login & roles coming soon • This sprint focuses on the interface & workflow
            </div>
          </div>

          {/* MINI STATUS */}
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
              These values are placeholders for now and will be connected to backend health endpoints.
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-semibold text-gray-900">How it works</h2>
          <Link to="/upload" className="text-sm font-medium text-gray-900 hover:underline">
            Go to Upload →
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s, idx) => (
            <div
              key={s.title}
              className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5"
            >
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{s.title}</h3>
              </div>
              <p className="mt-3 text-sm text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECENT ACTIVITY */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent activity</h2>
            <Link to="/history" className="text-sm font-medium text-gray-900 hover:underline">
              See all →
            </Link>
          </div>

          {recentRuns.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
              <p className="text-sm font-semibold text-gray-900">No runs yet</p>
              <p className="mt-2 text-sm text-gray-600">
                Start by adding a link on the Upload page. Your recent runs will appear here.
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
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{run.title}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {run.date} • {run.source}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {run.imagesFound} images • {run.flagged} flagged
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

        {/* QUICK ACTIONS / CARDS */}
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
              desc="Review previous runs and decisions (wire up later)."
              to="/history"
            />
            <QuickCard
              title="Profile"
              desc="Login, roles, and permissions (coming soon)."
              to="/profile"
            />
          </div>
        </div>
      </section>

      {/* TRUST / NOTES */}
      <section className="mt-8 mb-6 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Key notes</h2>
        <ul className="mt-3 grid gap-2 text-sm text-gray-600 list-disc pl-5">
          <li>
            This interface supports human verification to reduce false positives and improve metadata confidence.
          </li>
          <li>
            Source support will expand over time; initial rollout may prioritize a small set of known archive pages.
          </li>
          <li>
            Export, tagging, reviewer roles, and user management are planned for upcoming sprints.
          </li>
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
          →
        </div>
      </div>
    </Link>
  );
}