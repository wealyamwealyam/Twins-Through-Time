import { Link } from "react-router-dom";

export default function ErrorLayout({
  code,
  title,
  message,
  primaryAction,
  secondaryAction,
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-lg border border-gray-200 p-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 text-red-600 text-3xl font-bold mb-6">
          {code}
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-3">{title}</h1>

        <p className="text-gray-600 text-base sm:text-lg mb-8">{message}</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {primaryAction && (
            <Link
              to={primaryAction.to}
              className="px-6 py-3 rounded-xl bg-slate-700 text-white hover:bg-slate-800 transition"
            >
              {primaryAction.label}
            </Link>
          )}

          {secondaryAction && (
            <Link
              to={secondaryAction.to}
              className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
            >
              {secondaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}