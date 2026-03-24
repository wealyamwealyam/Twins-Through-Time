import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

const AUTH_KEY = "ttt_auth_v1";
const PROFILE_KEY = "ttt_profile_v1";
const USERS_KEY = "ttt_users_v1";

export default function Profile() {
  const defaultProfile = {
    userId: null,
    displayName: "Your Name",
    email: "",
    phone: "",
    role: "Reviewer",
    affiliation: "Twins Through Time",
    bio: "I help verify scraped Civil War photos and metadata.",
    preferences: {
      defaultLanding: "upload",
      notifications: true,
    },
    stats: {
      uploadsSubmitted: 0,
      reviewsCompleted: 0,
      flagsRaised: 0,
      agreementRate: null,
    },
  };

  const [profile, setProfile] = useState(defaultProfile);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let auth = null;
    let storedProfile = null;

    try {
      auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    } catch {
      auth = null;
    }

    try {
      storedProfile = JSON.parse(localStorage.getItem(PROFILE_KEY));
    } catch {
      storedProfile = null;
    }

    const authUser = auth?.user;

    const mergedProfile = {
      ...defaultProfile,
      ...(storedProfile || {}),
      userId: authUser?.id || storedProfile?.userId || null,
      displayName: authUser?.fullName || storedProfile?.displayName || defaultProfile.displayName,
      email: authUser?.email || storedProfile?.email || "",
      phone: authUser?.phone || storedProfile?.phone || "",
      role: authUser?.role || storedProfile?.role || defaultProfile.role,
    };

    setProfile(mergedProfile);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  const initials = useMemo(() => {
    const parts = (profile.displayName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = parts[0]?.[0] || "T";
    const b = parts[1]?.[0] || parts[0]?.[1] || "T";
    return (a + b).toUpperCase();
  }, [profile.displayName]);

  const agreementLabel =
    typeof profile.stats.agreementRate === "number"
      ? `${Math.max(0, Math.min(100, Math.round(profile.stats.agreementRate)))}%`
      : "—";

  const systemStatus = {
    account: { label: "Auth", value: profile.email ? "Signed in" : "Local-only" },
    storage: { label: "Local", value: "Enabled" },
    lastSync: { label: "Mock", value: "Instant" },
  };

  function syncUserRecord(updatedProfile) {
    try {
      const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
      if (auth?.user) {
        const updatedAuth = {
          ...auth,
          user: {
            ...auth.user,
            fullName: updatedProfile.displayName,
            email: updatedProfile.email,
            phone: updatedProfile.phone,
            role: updatedProfile.role,
          },
        };
        localStorage.setItem(AUTH_KEY, JSON.stringify(updatedAuth));
      }
    } catch {
      // ignore
    }

    try {
      const users = JSON.parse(localStorage.getItem(USERS_KEY)) || [];
      const nextUsers = users.map((user) =>
        user.id === updatedProfile.userId
          ? {
              ...user,
              fullName: updatedProfile.displayName,
              email: updatedProfile.email,
              phone: updatedProfile.phone,
              role: updatedProfile.role,
            }
          : user
      );
      localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
    } catch {
      // ignore
    }
  }

  function updateField(key, value) {
    setProfile((prev) => {
      const updated = { ...prev, [key]: value };
      syncUserRecord(updated);
      return updated;
    });
  }

  function updatePref(key, value) {
    setProfile((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: value },
    }));
  }

  function clearLocal() {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(AUTH_KEY);
    setProfile(defaultProfile);
    setIsEditing(false);
  }

  return (
    <div className="max-w-6xl mx-auto">
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
              Profile
            </h1>
            <p className="mt-3 text-gray-600 text-base md:text-lg">
              Manage your reviewer workspace settings. For this sprint, profile
              data is stored locally in your browser.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                {isEditing ? "Close editor" : "Edit profile"}
              </button>

              <Link
                to="/history"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
              >
                View history
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Local auth active • profile reflects current signed-in test user
            </div>
          </div>

          <div className="w-full md:w-[360px] rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Account status</h2>

            <div className="mt-4 grid gap-3">
              <StatusRow
                title="Account"
                label={systemStatus.account.label}
                value={systemStatus.account.value}
              />
              <StatusRow
                title="Storage"
                label={systemStatus.storage.label}
                value={systemStatus.storage.value}
              />
              <StatusRow
                title="Last sync"
                label={systemStatus.lastSync.label}
                value={systemStatus.lastSync.value}
              />
            </div>

            <div className="mt-4 text-xs text-gray-500">
              This is ready to swap to backend auth later.
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Profile details</h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearLocal}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
              >
                Clear local data
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold text-gray-900">
                  {profile.displayName}
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-900">
                  {profile.role}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{profile.affiliation}</div>
              <div className="text-xs text-gray-500 mt-1">{profile.email}</div>
              {profile.phone ? (
                <div className="text-xs text-gray-500 mt-1">{profile.phone}</div>
              ) : null}
              <div className="text-sm text-gray-600 mt-3">{profile.bio}</div>
            </div>
          </div>

          {isEditing && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Display name"
                  value={profile.displayName}
                  onChange={(v) => updateField("displayName", v)}
                  placeholder="e.g., Jane"
                />
                <Field
                  label="Role"
                  value={profile.role}
                  onChange={(v) => updateField("role", v)}
                  placeholder="e.g., Reviewer"
                />
                <Field
                  label="Email"
                  value={profile.email}
                  onChange={(v) => updateField("email", v)}
                  placeholder="you@example.com"
                />
                <Field
                  label="Phone"
                  value={profile.phone}
                  onChange={(v) => updateField("phone", v)}
                  placeholder="+1 555 123 4567"
                />
                <Field
                  label="Affiliation"
                  value={profile.affiliation}
                  onChange={(v) => updateField("affiliation", v)}
                  placeholder="e.g., Virginia Tech"
                />
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900">
                    Bio
                  </label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => updateField("bio", e.target.value)}
                    placeholder="What do you do in this project?"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 min-h-[96px]"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  Saved automatically to local storage.
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-semibold text-gray-900">
                  Default landing page
                </div>
                <div className="mt-3">
                  <select
                    value={profile.preferences.defaultLanding}
                    onChange={(e) => updatePref("defaultLanding", e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                  >
                    <option value="upload">Upload</option>
                    <option value="history">History</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Notifications
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      UI toggle for now.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updatePref("notifications", !profile.preferences.notifications)
                    }
                    className={[
                      "w-12 h-7 rounded-full transition flex items-center p-1",
                      profile.preferences.notifications ? "bg-gray-900" : "bg-gray-200",
                    ].join(" ")}
                    aria-pressed={profile.preferences.notifications}
                    aria-label="Toggle notifications"
                  >
                    <span
                      className={[
                        "w-5 h-5 rounded-full bg-white transition",
                        profile.preferences.notifications ? "translate-x-5" : "translate-x-0",
                      ].join(" ")}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Your stats</h2>

          <div className="mt-4 grid gap-3">
            <StatRow label="Uploads submitted" value={profile.stats.uploadsSubmitted} />
            <StatRow label="Reviews completed" value={profile.stats.reviewsCompleted} />
            <StatRow label="Flags raised" value={profile.stats.flagsRaised} />
            <StatRow label="Agreement rate" value={agreementLabel} />
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <div className="text-sm font-semibold text-gray-900">Coming soon</div>
            <div className="mt-2 text-sm text-gray-600">
              Real stats will come from backend runs + review decisions.
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>
            <div className="mt-4 grid gap-3">
              <QuickCard
                title="Upload"
                desc="Start a new scrape and begin verification."
                to="/upload"
              />
              <QuickCard
                title="History"
                desc="Review previous runs and decisions."
                to="/history"
              />
            </div>
          </div>
        </div>
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

function Field({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
      />
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-sm font-semibold text-gray-900">{value}</div>
    </div>
  );
}