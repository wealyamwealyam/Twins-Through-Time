import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { clearBackendSession, getBackendSession } from "../utils/apiClient";

export default function Navbar() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    user: null,
    profile: null,
  });

  useEffect(() => {
    let mounted = true;

    function loadAuth() {
      try {
        const backendSession = getBackendSession();

        if (backendSession?.user) {
          if (!mounted) return;

          setAuth({
            isAuthenticated: true,
            user: backendSession.user,
            profile: {
              display_name: backendSession.user.username,
              role: backendSession.user.accountType,
            },
          });
          return;
        }

        if (!mounted) return;
        setAuth({
          isAuthenticated: false,
          user: null,
          profile: null,
        });
      } catch {
        if (!mounted) return;

        setAuth({
          isAuthenticated: false,
          user: null,
          profile: null,
        });
      }
    }

    loadAuth();

    window.addEventListener("ttt-backend-session", loadAuth);

    return () => {
      mounted = false;
      window.removeEventListener("ttt-backend-session", loadAuth);
    };
  }, []);

  function handleSignOut() {
    clearBackendSession();

    setAuth({
      isAuthenticated: false,
      user: null,
      profile: null,
    });

    navigate("/login");
  }

  function handleBrandClick(e) {
    e.preventDefault();

    if (!auth.user) {
      navigate("/");
      return;
    }

    navigate("/upload");
  }

  const displayName =
    auth.profile?.display_name ||
    auth.user?.username ||
    auth.user?.email?.split("@")[0] ||
    "Profile";

  const isAdmin = auth.profile?.role === "admin" || auth.user?.accountType === "admin";

  return (
    <nav className="w-full bg-slate-700 text-white shadow-md">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBrandClick}
          className="text-xl font-semibold hover:text-blue-300 transition"
        >
          Twins Through Time
        </button>

        <div className="flex items-center gap-8">
          <div className="flex items-center space-x-8">
            <Link to="/" className="hover:text-blue-300 transition">
              Home
            </Link>

            <Link to="/upload" className="hover:text-blue-300 transition">
              Upload
            </Link>

            <Link to="/history" className="hover:text-blue-300 transition">
              History
            </Link>

            <Link to="/profile" className="hover:text-blue-300 transition">
              Profile
            </Link>

            {isAdmin ? (
              <Link to="/admin" className="hover:text-blue-300 transition">
                Admin
              </Link>
            ) : null}
          </div>

          <div className="h-6 w-px bg-slate-500" />

          {!auth.isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium bg-slate-600 hover:bg-slate-500 transition"
              >
                Login
              </Link>

              <Link
                to="/signup"
                className="rounded-lg px-4 py-2 text-sm font-semibold bg-white text-slate-700 hover:bg-slate-100 transition"
              >
                Sign up
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="text-sm text-slate-200 max-w-[220px] truncate hover:text-white transition"
              >
                {displayName}
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg px-4 py-2 text-sm font-medium bg-slate-600 hover:bg-slate-500 transition"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
