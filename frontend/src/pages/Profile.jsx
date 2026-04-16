import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import { clearBackendSession, apiRequest, getBackendSession } from "../utils/apiClient";

const defaultProfile = {
  id: null,
  username: "",
  email: "",
  firstName: "",
  lastName: "",
  age: "",
  gender: "",
  accountType: "community_member",
};

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(defaultProfile);
  const [authState, setAuthState] = useState("loading");
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [changeRequests, setChangeRequests] = useState([]);
  const [roleRequest, setRoleRequest] = useState({
    requestingAccount: "contributor",
    reasonMessage: "",
  });
  const [isRequestingRole, setIsRequestingRole] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setAuthState("loading");
      setMessage("");

      if (!getBackendSession()?.token) {
        setProfile(defaultProfile);
        setAuthState("guest");
        return;
      }

      try {
        const [profileData, requestsData] = await Promise.all([
          apiRequest("/account/profile"),
          apiRequest("/account-change-requests/me").catch(() => []),
        ]);

        if (cancelled) return;

        setProfile({
          ...defaultProfile,
          ...profileData,
          age: profileData?.age ?? "",
          gender: profileData?.gender ?? "",
        });
        setChangeRequests(Array.isArray(requestsData) ? requestsData : []);
        setAuthState("authenticated");
      } catch (error) {
        if (!cancelled) {
          setProfile(defaultProfile);
          setAuthState("guest");
          setMessage(error?.message || "Unable to load profile.");
        }
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.username || "User";

  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] || "T";
    const b = parts[1]?.[0] || parts[0]?.[1] || "T";
    return (a + b).toUpperCase();
  }, [displayName]);

  const availableRoleRequests = useMemo(() => {
    if (profile.accountType === "community_member") return ["contributor", "admin"];
    if (profile.accountType === "contributor") return ["admin"];
    return [];
  }, [profile.accountType]);

  useEffect(() => {
    if (
      availableRoleRequests.length > 0 &&
      !availableRoleRequests.includes(roleRequest.requestingAccount)
    ) {
      setRoleRequest((prev) => ({
        ...prev,
        requestingAccount: availableRoleRequests[0],
      }));
    }
  }, [availableRoleRequests, roleRequest.requestingAccount]);

  function updateField(key, value) {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function saveProfile() {
    if (authState !== "authenticated" || !profile.id) {
      setMessage("Please sign in to save profile changes.");
      return;
    }

    setIsSaving(true);
    setMessage("");

    try {
      const updates = {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
      };

      if (profile.age !== "") {
        updates.age = Number(profile.age);
      }

      if (profile.gender) {
        updates.gender = profile.gender;
      }

      const updated = await apiRequest("/account/profile", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      setProfile({
        ...defaultProfile,
        ...updated,
        age: updated?.age ?? "",
        gender: updated?.gender ?? "",
      });
      setIsEditing(false);
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error?.message || "Something went wrong while saving your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccount() {
  const confirmed = window.confirm(
    "Are you sure you want to delete your account? This action cannot be undone."
  );

  if (!confirmed) return;

  setIsDeleting(true);
  setMessage("");

  try {
    await apiRequest("/account/profile", {
      method: "DELETE",
    });

    clearBackendSession();
    navigate("/login", { replace: true });
  } catch (error) {
    setMessage(error?.message || "Unable to delete account.");
  } finally {
    setIsDeleting(false);
  }
}

  async function submitRoleRequest(e) {
    e.preventDefault();

    if (!roleRequest.reasonMessage.trim()) {
      setMessage("Please add a reason for the account change request.");
      return;
    }

    setIsRequestingRole(true);
    setMessage("");

    try {
      const request = await apiRequest("/account-change-requests", {
        method: "POST",
        body: JSON.stringify({
          requestingAccount: roleRequest.requestingAccount,
          reasonMessage: roleRequest.reasonMessage,
        }),
      });

      setChangeRequests((prev) => [request, ...prev]);
      setRoleRequest((prev) => ({ ...prev, reasonMessage: "" }));
      setMessage("Account change request submitted.");
    } catch (error) {
      setMessage(error?.message || "Unable to submit account change request.");
    } finally {
      setIsRequestingRole(false);
    }
  }

  function handleSignOut() {
    clearBackendSession();
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
            Sign in to view and edit your backend profile.
          </p>

          {message ? (
            <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {message}
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
              Manage your backend account profile and role requests.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsEditing((value) => !value)}
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
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
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
                  {displayName}
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-900">
                  {profile.accountType}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">@{profile.username}</div>
              <div className="text-xs text-gray-500 mt-1">{profile.email}</div>
              <div className="text-xs text-gray-500 mt-1">
                {profile.gender || "No gender set"} | {profile.age || "No age set"}
              </div>
            </div>
          </div>

          {isEditing ? (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Username" value={profile.username} onChange={(value) => updateField("username", value)} placeholder="jsmith" />
                <Field label="First name" value={profile.firstName} onChange={(value) => updateField("firstName", value)} placeholder="John" />
                <Field label="Last name" value={profile.lastName} onChange={(value) => updateField("lastName", value)} placeholder="Smith" />
                <Field label="Age" type="number" value={profile.age} onChange={(value) => updateField("age", value)} placeholder="34" />
                <div>
                  <label className="block text-sm font-semibold text-gray-900">Gender</label>
                  <select
                    value={profile.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                  >
                    <option value="">Not set</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
                <Field label="Email" value={profile.email} onChange={() => {}} placeholder="you@example.com" disabled />
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500">Email and role changes use dedicated backend flows.</div>
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
          ) : null}
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Account access</h2>
          <div className="mt-4 grid gap-3 text-sm text-gray-600">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-3">
              <span className="font-semibold text-gray-900">Current role</span>
              <span>{profile.accountType}</span>
            </div>
          </div>

          {availableRoleRequests.length > 0 ? (
            <form onSubmit={submitRoleRequest} className="mt-5 grid gap-3">
              <label>
                <span className="block text-sm font-semibold text-gray-900">Request role</span>
                <select
                  value={roleRequest.requestingAccount}
                  onChange={(e) => setRoleRequest((prev) => ({ ...prev, requestingAccount: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                >
                  {availableRoleRequests.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>

              <label>
                <span className="block text-sm font-semibold text-gray-900">Reason</span>
                <textarea
                  value={roleRequest.reasonMessage}
                  onChange={(e) => setRoleRequest((prev) => ({ ...prev, reasonMessage: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 min-h-[96px]"
                  placeholder="Explain why this account access is needed."
                />
              </label>

              <button
                type="submit"
                disabled={isRequestingRole}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60"
              >
                {isRequestingRole ? "Submitting..." : "Submit request"}
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-gray-600">No higher role is available to request.</p>
          )}

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-900">Recent requests</h3>
            <div className="mt-3 grid gap-2">
              {changeRequests.length === 0 ? (
                <p className="text-sm text-gray-500">No account change requests yet.</p>
              ) : (
                changeRequests.slice(0, 3).map((request) => (
                  <div key={request.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                    <div className="font-semibold text-gray-900">{request.requestingAccount}</div>
                    <div className="mt-1 text-xs text-gray-500">{request.status}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Danger zone</h2>
        <p className="mt-2 text-sm text-red-700">
          Deleting your account permanently removes your profile and signs you out.
          This action cannot be undone.
        </p>

        <div className="mt-4">
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-60"
          >
            {isDeleting ? "Deleting account..." : "Delete account"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", disabled = false }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 disabled:bg-gray-100 disabled:text-gray-500"
      />
    </div>
  );
}

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired,
  type: PropTypes.string,
  disabled: PropTypes.bool,
};
