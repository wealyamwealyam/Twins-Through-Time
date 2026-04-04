import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { getMe, updateMe } from "../services/accountService";

export default function Profile() {
  const { user, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState({
    displayName: "",
    affiliation: "",
    bio: "",
    preferences: {
      defaultLanding: "upload",
      notifications: true,
    },
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load profile from API when user is available
  useEffect(() => {
    if (!user) return;
    getMe()
      .then((data) => {
        setProfile({
          displayName: [data.firstName, data.lastName].filter(Boolean).join(" ") || data.username || "",
          affiliation: data.affiliation || "",
          bio: data.bio || "",
          preferences: {
            defaultLanding: data.preferences?.defaultLanding ?? "upload",
            notifications: data.preferences?.notifications ?? true,
          },
        });
      })
      .catch((err) => setLoadError(err.message || "Failed to load profile."));
  }, [user]);

  const initials = useMemo(() => {
    const parts = (profile.displayName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const a = parts[0]?.[0] || "T";
    const b = parts[1]?.[0] || parts[0]?.[1] || "T";
    return (a + b).toUpperCase();
  }, [profile.displayName]);

  const systemStatus = {
    account: {
      label: user?.accountType ?? "—",
      value: user?.isActive ? "Active" : user ? "Inactive" : "—",
    },
    storage: { label: "Enabled", value: "Supabase" },
    lastSync: { label: "Live", value: user ? "Connected" : "—" },
  };

  function updateField(key, value) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function updatePref(key, value) {
    setProfile((p) => ({ ...p, preferences: { ...p.preferences, [key]: value } }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const [firstName, ...rest] = profile.displayName.trim().split(/\s+/);
      await updateMe({
        firstName: firstName || "",
        lastName: rest.join(" ") || "",
        affiliation: profile.affiliation,
        bio: profile.bio,
        preferences: profile.preferences,
      });
      setSaveSuccess(true);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err.message || "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center">
        <p className="text-gray-600">Please <Link to="/login" className="underline font-semibold">log in</Link> to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {loadError && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* HERO */}
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
              Profile
            </h1>
            <p className="mt-3 text-gray-600 text-base md:text-lg">
              Manage your account settings. Changes are saved to the database.
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
              Logged in as <span className="font-semibold">{user.username}</span> &bull; {user.email}
            </div>
          </div>

          {/* MINI STATUS */}
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
              Connected to your live account and database.
            </div>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DETAILS */}
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Profile details</h2>

            <div className="flex items-center gap-2">
              {saveError && (
                <span className="text-xs text-red-600">{saveError}</span>
              )}
              {saveSuccess && (
                <span className="text-xs text-green-600">Saved!</span>
              )}
            </div>
          </div>

          <div className="mt-5 flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gray-900 text-white flex items-center justify-center text-sm font-bold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="text-sm font-semibold text-gray-900">
                  {profile.displayName || user.username}
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-900">
                  {user.accountType}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{profile.affiliation}</div>
              <div className="text-sm text-gray-600 mt-3">{profile.bio}</div>
            </div>
          </div>

          {/* EDITOR */}
          {isEditing && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field
                  label="Display name"
                  value={profile.displayName}
                  onChange={(v) => updateField("displayName", v)}
                  placeholder="e.g., Vedanshi Jain"
                />
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Account type</label>
                  <input
                    value={user.accountType}
                    readOnly
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>
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
                  Changes are saved to the database.
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 disabled:opacity-50 transition"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          )}

          {/* PREFERENCES */}
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
                <div className="mt-3 text-xs text-gray-500">
                  Later: we can auto-redirect you after login.
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Notifications
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      UI toggle for now (connect to backend later).
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

        {/* RIGHT COLUMN: STATS + QUICK ACTIONS */}
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Your stats</h2>

          <div className="mt-4 grid gap-3">
            <StatRow label="Uploads submitted" value="—" />
            <StatRow label="Reviews completed" value="—" />
            <StatRow label="Flags raised" value="—" />
            <StatRow label="Agreement rate" value="—" />
          </div>

          <div className="mt-5 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <div className="text-sm font-semibold text-gray-900">Coming soon</div>
            <div className="mt-2 text-sm text-gray-600">
              Stats will reflect your verification work once review decisions are tracked.
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

      {/* KEY NOTES */}
      <section className="mt-8 mb-6 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900">Key notes</h2>
        <ul className="mt-3 grid gap-2 text-sm text-gray-600 list-disc pl-5">
          <li>
            Profile data is stored in the database and synced to your account.
          </li>
          <li>
            Account type is managed by admins and cannot be changed here.
          </li>
          <li>
            Stats will reflect your verification work (flags, approvals, and agreement with final outcomes).
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