import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="w-full bg-slate-700 text-white shadow-md">
      <div className="w-full px-6 py-4 flex justify-space-between">

        <div className="px-6 text-xl font-semibold">
          Twins Through Time
        </div>

        <div className="flex space-x-8">
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

          <Link to="/admin" className="hover:text-blue-400">
            Admin
          </Link>
        </div>

      </div>
    </nav>
  );
}
