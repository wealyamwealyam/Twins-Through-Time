import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  function validateEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
  }

  function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!validateEmail(form.email)) {
      setMessage("Please enter a valid email address.");
      return;
    }

    if (!form.password.trim()) {
      setMessage("Please enter your password.");
      return;
    }

    // Mock login for now
    localStorage.setItem(
      "ttt_auth_v1",
      JSON.stringify({
        isAuthenticated: true,
        user: {
          fullName: "Demo User",
          email: form.email.trim(),
          phone: "",
        },
      })
    );

    navigate("/profile");
  }

  return (
    <div className="max-w-6xl mx-auto">
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
              Sign in
            </h1>
            <p className="mt-3 text-gray-600 text-base md:text-lg">
              Access your account to manage profile settings, review history, and saved preferences.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                Create account
              </Link>

              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
              >
                Back to home
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              Auth is UI-only for now so testing stays fast.
            </div>
          </div>

          <div className="w-full md:w-[360px] rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Why sign in?</h2>
            <div className="mt-4 grid gap-3 text-sm text-gray-600">
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                Save your account details
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                Access profile and preferences
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3">
                Support protected pages later
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Account access</h2>

          {message ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="grid grid-cols-1 gap-4">
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="you@example.com"
              />

              <PasswordField
                label="Password"
                value={form.password}
                onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                placeholder="Enter your password"
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
              />

              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={(e) => setForm((f) => ({ ...f, remember: e.target.checked }))}
                  />
                  Remember me
                </label>

                <button
                  type="button"
                  className="text-sm font-medium text-gray-900 hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>

          <div className="mt-4 grid gap-3">
            <QuickCard
              title="Create account"
              desc="Set up a new user account with secure credentials."
              to="/signup"
            />
            <QuickCard
              title="Back home"
              desc="Return to the homepage and keep testing freely."
              to="/"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder, visible, onToggle }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-900">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
        />
        <button
          type="button"
          onClick={onToggle}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {visible ? "Hide" : "Show"}
        </button>
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