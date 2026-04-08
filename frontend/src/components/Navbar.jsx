import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <nav className="w-full bg-slate-700 text-white shadow-md">
      <div className="w-full px-6 py-4 flex justify-space-between">

        <div className="px-6 text-xl font-semibold">
          Twins Through Time
        </div>

        <div className="flex space-x-8 items-center">
          <Link to="/" className="hover:text-blue-400">
            Home
          </Link>

          <Link to="/upload" className="hover:text-blue-400">
            Upload
          </Link>

          <Link to="/history" className="hover:text-blue-400">
            History
          </Link>

          <Link to="/profile" className="hover:text-blue-400">
            Profile
          </Link>

          {user ? (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-500">
              <span className="text-sm text-slate-300">
                {user.username}
                <span className="ml-1.5 text-xs bg-slate-600 px-1.5 py-0.5 rounded-full text-slate-200">
                  {user.accountType}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-slate-300 hover:text-red-400 transition"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-500">
              <Link to="/login" className="text-sm hover:text-blue-400">
                Login
              </Link>
              <Link
                to="/register"
                className="text-sm bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded-lg transition"
              >
                Register
              </Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}