import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function Navbar() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState({
    isAuthenticated: false,
    user: null,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ttt_auth_v1");
      if (stored) {
        setAuth(JSON.parse(stored));
      }
    } catch {
      setAuth({
        isAuthenticated: false,
        user: null,
      });
    }
  }, []);

  function handleSignOut() {
    localStorage.removeItem("ttt_auth_v1");
    setAuth({
      isAuthenticated: false,
      user: null,
    });
    navigate("/");
  }

  return (
    <nav className="w-full bg-slate-700 text-white shadow-md">
      <div className="w-full px-6 py-4 flex items-center justify-between">
        
        {/* Brand */}
        <Link
          to="/"
          className="text-xl font-semibold hover:text-blue-300 transition"
        >
          Twins Through Time
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-8">
          
          {/* Nav links */}
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

            <Link to="/admin" className="hover:text-blue-300 transition">
              Admin
            </Link>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-slate-500" />

          {/* Auth section */}
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
              <div className="text-sm text-slate-200 max-w-[220px] truncate">
                {auth.user?.email || "Signed in"}
              </div>

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