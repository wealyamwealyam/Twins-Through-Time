import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import PropTypes from "prop-types";
import { apiRequest, saveBackendSession } from "../utils/apiClient";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
    remember: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateEmail(email) {
    return /\S+@\S+\.\S+/.test(email);
  }

  async function handleSubmit(e) {
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

    setIsSubmitting(true);

    try {
      const email = form.email.trim().toLowerCase();

      const backendSession = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password: form.password,
        }),
      });

      saveBackendSession(backendSession);

      if (backendSession?.user?.accountType === "admin") {
        navigate("/admin");
        return;
      }

      navigate("/profile");
    } catch (error) {
      setMessage(error?.message || "Something went wrong while signing in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <section className="rounded-2xl bg-white shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
          Sign in
        </h1>

        {message ? (
          <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            {message}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5"
        >
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 transition disabled:opacity-60"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-6">
          <Link
            to="/signup"
            className="text-sm font-medium text-gray-900 hover:underline"
          >
            Need an account?
          </Link>
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

Field.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  type: PropTypes.string,
};

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

PasswordField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  visible: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};
