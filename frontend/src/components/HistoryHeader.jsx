import PropTypes from "prop-types";

export default function HistoryHeader({
    title = "Historical Records",
    subtitle = "Browse and explore previously analyzed photos",
    onSearchChange,
  }) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          
          {/* Title section */}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {title}
            </h1>
            <p className="text-sm text-gray-500">
              {subtitle}
            </p>
          </div>
  
          {/* Actions */}
          <div className="flex items-center gap-3">
            
            {/* Search */}
            {onSearchChange && (
              <input
                type="text"
                placeholder="Search records..."
                onChange={(e) => onSearchChange(e.target.value)}
                className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-black"
              />
            )}
  
          </div>
        </div>
  
        {/* Divider */}
        <div className="mt-4 border-t" />
      </div>
    );
  }

HistoryHeader.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  onSearchChange: PropTypes.func,
};
