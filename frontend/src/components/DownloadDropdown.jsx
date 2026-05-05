import { useState } from "react";
import PropTypes from "prop-types";

export default function DownloadDropdown({
  label = "Download",
  options,
  disabled = false,
  busy = false,
}) {
  const [isOpen, setIsOpen] = useState(false);

  function handleOptionClick(option) {
    setIsOpen(false);
    option.onClick();
  }

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        disabled={disabled || busy}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((current) => !current);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Downloading..." : label}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled || busy}
              onClick={(event) => {
                event.stopPropagation();
                handleOptionClick(option);
              }}
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

DownloadDropdown.propTypes = {
  label: PropTypes.string,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      disabled: PropTypes.bool,
      onClick: PropTypes.func.isRequired,
    })
  ).isRequired,
  disabled: PropTypes.bool,
  busy: PropTypes.bool,
};
