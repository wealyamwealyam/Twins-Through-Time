import { useMemo, useState } from "react";

import AdminSectionNav from "../components/AdminSectionNav";

const seedUsers = [
  {
    id: "USR-201",
    username: "admin_jordan",
    email: "jordan@example.edu",
    accountType: "admin",
    isActive: true,
    lastSeen: "2 hours ago",
  },
  {
    id: "USR-202",
    username: "emily_review",
    email: "emily@example.edu",
    accountType: "contributor",
    isActive: true,
    lastSeen: "Today",
  },
  {
    id: "USR-203",
    username: "tom_archive",
    email: "tom@example.edu",
    accountType: "community_member",
    isActive: false,
    lastSeen: "8 days ago",
  },
  {
    id: "USR-204",
    username: "nina_ops",
    email: "nina@example.edu",
    accountType: "admin",
    isActive: true,
    lastSeen: "Yesterday",
  },
  {
    id: "USR-205",
    username: "sam_history",
    email: "sam@example.edu",
    accountType: "contributor",
    isActive: true,
    lastSeen: "5 minutes ago",
  },
];

export default function AdminUsers() {
  const [users, setUsers] = useState(seedUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        search.trim() === "" ||
        user.username.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole =
        roleFilter === "all" || user.accountType === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.isActive) ||
        (statusFilter === "inactive" && !user.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  function toggleActive(id) {
    setUsers((current) =>
      current.map((user) =>
        user.id === id ? { ...user, isActive: !user.isActive } : user
      )
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          User management
        </h1>
        <p className="mt-3 max-w-3xl text-base text-gray-600">
          Prototype of the planned admin user directory. Filters and actions here
          mirror the API shape in the project docs.
        </p>
      </section>

      <div className="mt-6">
        <AdminSectionNav />
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
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

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="pb-3 font-semibold">User</th>
                <th className="pb-3 font-semibold">Role</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Last seen</th>
                <th className="pb-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="py-4">
                    <div className="font-semibold text-gray-900">{user.username}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </td>
                  <td className="py-4">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                      {formatRole(user.accountType)}
                    </span>
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
                  <td className="py-4 text-gray-700">{user.lastSeen}</td>
                  <td className="py-4">
                    <button
                      type="button"
                      onClick={() => toggleActive(user.id)}
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

function formatRole(role) {
  if (role === "community_member") {
    return "Community member";
  }

  return role.charAt(0).toUpperCase() + role.slice(1);
}
