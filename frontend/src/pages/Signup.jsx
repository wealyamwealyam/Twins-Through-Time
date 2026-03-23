import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    smsConsent: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");

  function validateEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
  }

  function validatePhone(phone) {
    if (!phone.trim()) return true;
    return /^[0-9+()\-\s]{7,20}$/.test(phone);
  }

  function getPasswordChecks(password) {
    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    };
  }

  const passwordChecks = useMemo(() => getPasswordChecks(form.password), [form.password]);
  const passwordStrong = Object.values(passwordChecks).every(Boolean);

  function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    if (!form.fullName.trim()) {
      setMessage("Please enter your full name.");
      return;
    }

    if (!validateEmail(form.email)) {
      setMessage("Please enter a valid email address.");
      return;
    }

    if (!validatePhone(form.phone)) {
      setMessage("Please enter a valid phone number.");
      return;
    }

    if (!passwordStrong) {
      setMessage("Password does not meet the security requirements.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!form.termsAccepted) {
      setMessage("You must accept the terms and privacy policy.");
      return;
    }

    if (form.phone.trim() && !form.smsConsent) {
      setMessage("Please confirm SMS consent if you provide a phone number.");
      return;
    }

    localStorage.setItem(
      "ttt_auth_v1",
      JSON.stringify({
        isAuthenticated: true,
        user: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
      })
    );

    localStorage.setItem(
      "ttt_profile_v1",
      JSON.stringify({
        displayName: form.fullName.trim(),
        role: "Member",
        affiliation: "Twins Through Time",
        bio: "New account created.",
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
              Create account
            </h1>
            <p className="mt-3 text-gray-600 text-base md:text-lg">
              Set up your account with email and a secure password. Phone number is optional and should only be used with explicit SMS consent.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                Already have an account?
              </Link>

              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-gray-900 bg-gray-100 hover:bg-gray-200 transition"
              >
                Back to home
              </Link>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              This is a frontend flow for now. Real verification and password security come with backend auth.
            </div>
          </div>

          <div className="w-full md:w-[360px] rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Included</h2>
            <div className="mt-4 grid gap-3 text-sm text-gray-600">
              <div className="rounded-xl border border-gray-200 bg-white p-3">Email required</div>
              <div className="rounded-xl border border-gray-200 bg-white p-3">Optional phone number</div>
              <div className="rounded-xl border border-gray-200 bg-white p-3">Strong password checks</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">New account</h2>

          {message ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              {message}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Full name"
                value={form.fullName}
                onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
                placeholder="Jane Doe"
              />

              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                placeholder="you@example.com"
              />

              <Field
                label="Phone number (optional)"
                value={form.phone}
                onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                placeholder="+1 555 123 4567"
              />

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <PasswordField
                  label="Password"
                  value={form.password}
                  onChange={(v) => setForm((f) => ({ ...f, password: v }))}
                  placeholder="Create a secure password"
                  visible={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                />

                <PasswordField
                  label="Confirm password"
                  value={form.confirmPassword}
                  onChange={(v) => setForm((f) => ({ ...f, confirmPassword: v }))}
                  placeholder="Re-enter password"
                  visible={showConfirmPassword}
                  onToggle={() => setShowConfirmPassword((v) => !v)}
                />
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Password requirements</div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <PasswordCheck ok={passwordChecks.length} text="At least 8 characters" />
                <PasswordCheck ok={passwordChecks.uppercase} text="One uppercase letter" />
                <PasswordCheck ok={passwordChecks.lowercase} text="One lowercase letter" />
                <PasswordCheck ok={passwordChecks.number} text="One number" />
                <PasswordCheck ok={passwordChecks.special} text="One special character" />
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={(e) => setForm((f) => ({ ...f, termsAccepted: e.target.checked }))}
                  className="mt-1"
                />
                <span>I agree to the Terms of Service and Privacy Policy.</span>
              </label>

              {form.phone.trim() ? (
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.smsConsent}
                    onChange={(e) => setForm((f) => ({ ...f, smsConsent: e.target.checked }))}
                    className="mt-1"
                  />
                  <span>I agree to receive text messages for account-related notifications.</span>
                </label>
              ) : null}
            </div>

            <div className="mt-5">
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition"
              >
                Create account
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900">Quick actions</h2>

          <div className="mt-4 grid gap-3">
            <QuickCard
              title="Sign in"
              desc="Already have an account? Go to the login page."
              to="/login"
            />
            <QuickCard
              title="Back home"
              desc="Keep testing the app without forcing auth yet."
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

function PasswordCheck({ ok, text }) {
  return (
    <div className={`rounded-lg px-3 py-2 border text-sm ${ok ? "border-gray-300 bg-gray-50 text-gray-900" : "border-gray-200 bg-white text-gray-600"}`}>
      {ok ? "✓" : "•"} {text}
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