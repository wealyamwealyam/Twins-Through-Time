import { useEffect, useState } from "react";

import AdminSectionNav from "../components/AdminSectionNav";
import { apiRequest } from "../utils/apiClient";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setIsLoading(true);
      setMessage("");

      try {
        const params = new URLSearchParams({ limit: "100" });

        if (roleFilter !== "all") {
          params.set("accountType", roleFilter);
        }

        if (statusFilter !== "all") {
          params.set("isActive", statusFilter === "active" ? "true" : "false");
        }

        if (search.trim()) {
          params.set("search", search.trim());
        }

        const result = await apiRequest(`/admin/users?${params.toString()}`);

        if (!cancelled) {
          setUsers(result?.data || []);
          setTotal(result?.total || 0);
        }
      } catch (error) {
        if (!cancelled) {
          setUsers([]);
          setTotal(0);
          setMessage(error?.message || "Unable to load admin users.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [roleFilter, statusFilter, search]);

  async function deactivateUser(id) {
    setMessage("");

    try {
      const result = await apiRequest(`/admin/users/${id}/deactivate`, {
        method: "PATCH",
      });

      setUsers((current) =>
        current.map((user) =>
          user.id === id ? { ...user, isActive: result.isActive } : user
        )
      );
      setMessage("User deactivated.");
    } catch (error) {
      setMessage(error?.message || "Unable to deactivate user.");
    }
  }

  async function reactivateUser(id) {
    setMessage("");

    try {
      const result = await apiRequest(`/admin/users/${id}/reactivate`, {
        method: "PATCH",
      });

      setUsers((current) =>
        current.map((user) =>
          user.id === id ? { ...user, isActive: result.isActive } : user
        )
      );
      setMessage("User reactivated.");
    } catch (error) {
      setMessage(error?.message || "Unable to reactivate user.");
    }
  }

  async function updateRole(id, accountType) {
    setMessage("");

    try {
      const updated = await apiRequest(`/account/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ accountType }),
      });

      setUsers((current) =>
        current.map((user) => (user.id === id ? { ...user, ...updated } : user))
      );
      setMessage("User role updated.");
    } catch (error) {
      setMessage(error?.message || "Unable to update user role.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          User management
        </h1>
        <p className="mt-3 max-w-3xl text-base text-gray-600">
          Manage real backend users, filter by role/status, update roles, and
          deactivate accounts.
        </p>
      </section>

      <div className="mt-6">
        <AdminSectionNav />
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {message ? (
          <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {message}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <label className="md:col-span-2">
            <div className="text-sm font-semibold text-gray-900">Search</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or email"
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            />
          </label>

          <label>
            <div className="text-sm font-semibold text-gray-900">Role</div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="contributor">Contributor</option>
              <option value="community_member">Community member</option>
            </select>
          </label>

          <label>
            <div className="text-sm font-semibold text-gray-900">Status</div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
            >
              <option value="all">All users</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className="mt-5 text-sm text-gray-500">
          {isLoading ? "Loading users..." : `${total} backend user${total === 1 ? "" : "s"} found`}
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="pb-3 font-semibold">User</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Updated</th>
                <th className="pb-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading && users.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-sm text-gray-500" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              ) : null}

              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-4">
                    <div className="font-semibold text-gray-900">{user.username}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                    <div className="text-xs text-gray-400">ID {user.id}</div>
                  </td>
                  <td className="py-4">
                    <select
                      value={user.accountType}
                      onChange={(e) => updateRole(user.id, e.target.value)}
                      className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 outline-none focus:border-gray-300 focus:ring-2 focus:ring-gray-900/10"
                    >
                      <option value="community_member">Community member</option>
                      <option value="contributor">Contributor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="py-4">
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        user.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-200 text-gray-700",
                      ].join(" ")}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="py-4 text-gray-700">
                    {formatDate(user.updatedAt || user.createdAt)}
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      onClick={() =>
                        user.isActive ? deactivateUser(user.id) : reactivateUser(user.id)
                      }
                      className={[
                        "rounded-xl px-4 py-2 text-xs font-semibold transition",
                        user.isActive
                          ? "bg-red-50 text-red-700 hover:bg-red-100"
                          : "bg-gray-900 text-white hover:bg-gray-800",
                      ].join(" ")}
                    >
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) {
    return "Unknown";
  }

  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
