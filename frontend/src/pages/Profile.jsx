import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { getSafeSession } from "../utils/authSession";

export default function Profile() {
  const navigate = useNavigate();

  const defaultProfile = {
    userId: null,
    displayName: "",
    email: "",
    phone: "",
    role: "member",
    affiliation: "Twins Through Time",
    bio: "",
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
  const [authState, setAuthState] = useState("loading"); // loading | guest | authenticated
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setAuthState("loading");
      setMessage("");
      setSessionMessage("");

      try {
        const { session, recovered, error } = await getSafeSession(supabase, 2500);
        const user = session?.user ?? null;

        if (!user) {
          if (!cancelled) {
            setProfile(defaultProfile);
            setAuthState("guest");

            if (recovered) {
              setSessionMessage("We reset a stale local session. Please sign in again.");
            } else if (error?.message === "Auth request timed out.") {
              setSessionMessage("Auth request timed out. Please sign in again.");
            } else {
              setSessionMessage("You are not signed in.");
            }
          }
          return;
        }

        const [profileRes, preferencesRes, statsRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("profile_preferences").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("user_stats").select("*").eq("user_id", user.id).maybeSingle(),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (preferencesRes.error) throw preferencesRes.error;
        if (statsRes.error) throw statsRes.error;

        if (cancelled) return;

        const profileRow = profileRes.data;
        const preferencesRow = preferencesRes.data;
        const statsRow = statsRes.data;

        setProfile({
          userId: user.id,
          displayName:
            profileRow?.display_name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User",
          email: profileRow?.email || user.email || "",
          phone: profileRow?.phone || user.user_metadata?.phone || "",
          role: profileRow?.role || "member",
          affiliation: profileRow?.affiliation || "Twins Through Time",
          bio:
            profileRow?.bio ||
            "Manage your reviewer workspace settings and saved preferences.",
          preferences: {
            defaultLanding: preferencesRow?.default_landing || "upload",
            notifications: preferencesRow?.notifications ?? true,
          },
          stats: {
            uploadsSubmitted: statsRow?.uploads_submitted ?? 0,
            reviewsCompleted: statsRow?.reviews_completed ?? 0,
            flagsRaised: statsRow?.flags_raised ?? 0,
            agreementRate: statsRow?.agreement_rate ?? null,
          },
        });

        setAuthState("authenticated");
      } catch (error) {
        if (!cancelled) {
          setProfile(defaultProfile);
          setAuthState("guest");
          setSessionMessage(error?.message || "Unable to load session.");
        }
      }
    }

    loadProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;

      if (!session?.user) {
        setProfile(defaultProfile);
        setAuthState("guest");
        setIsEditing(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

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

  function updateField(key, value) {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updatePref(key, value) {
    setProfile((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, [key]: value },
    }));
  }

  async function saveProfile() {
    if (authState !== "authenticated" || !profile.userId) {
      setMessage("Please sign in to save profile changes.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const { error: profileError } = await supabase.from("profiles").upsert(
        {
          id: profile.userId,
          display_name: profile.displayName,
          email: profile.email,
          phone: profile.phone || null,
          role: profile.role,
          affiliation: profile.affiliation,
          bio: profile.bio,
        },
        { onConflict: "id" }
      );

      if (profileError) throw profileError;

      const { error: preferencesError } = await supabase
        .from("profile_preferences")
        .upsert(
          {
            user_id: profile.userId,
            default_landing: profile.preferences.defaultLanding,
            notifications: profile.preferences.notifications,
          },
          { onConflict: "user_id" }
        );

      if (preferencesError) throw preferencesError;

      setIsEditing(false);
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error?.message || "Something went wrong while saving your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  if (authState === "loading") {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-8 text-left">
          Loading profile...
        </div>
      </div>
    );
  }

  if (authState === "guest") {
    return (
      <div className="max-w-6xl mx-auto">
        <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
            Profile
          </h1>
          <p className="mt-3 text-gray-600 text-base md:text-lg">
            Sign in to view and edit your profile, preferences, and activity stats.
          </p>

          {sessionMessage ? (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {sessionMessage}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
            >
              Sign in
            </Link>

            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
            >
              Create account
            </Link>
          </div>
        </section>
      </div>
    );
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
              Manage your reviewer workspace settings. Profile data now syncs with Supabase.
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

              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          {message ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {message}
            </div>
          ) : null}

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
              {profile.phone ? <div className="text-xs text-gray-500 mt-1">{profile.phone}</div> : null}
              <div className="text-sm text-gray-600 mt-3">{profile.bio}</div>
            </div>
          </div>

          {isEditing && (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Display name" value={profile.displayName} onChange={(v) => updateField("displayName", v)} placeholder="e.g., Jane" />
                <Field label="Email" value={profile.email} onChange={(v) => updateField("email", v)} placeholder="you@example.com" />
                <Field label="Phone" value={profile.phone} onChange={(v) => updateField("phone", v)} placeholder="+1 555 123 4567" />
                <Field label="Affiliation" value={profile.affiliation} onChange={(v) => updateField("affiliation", v)} placeholder="e.g., Virginia Tech" />
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900">Bio</label>
                  <textarea
                    value={profile.bio}
                    onChange={(e) => updateField("bio", e.target.value)}
                    placeholder="What do you do in this project?"
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 min-h-[96px]"
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">Changes save to Supabase.</div>
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900">Preferences</h2>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="text-sm font-semibold text-gray-900">Default landing page</div>
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
                    <div className="text-sm font-semibold text-gray-900">Notifications</div>
                    <div className="mt-1 text-xs text-gray-500">Toggle preference saved in database.</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => updatePref("notifications", !profile.preferences.notifications)}
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
        </div>
      </section>
    </div>
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