import { useState } from "react";
import PropTypes from "prop-types";

import ConfidenceBadge from "./ConfidenceBadge";

export default function Record({
    imageSrc,
    imageAlt = "Historical photo",
    title,
    subtitle,
    date,
    location,
    traits = [],
    confidenceScore,
    selected = false,
    onSelectChange,
    actionSlot,
    onClick,
  }) {
    const [imageFailed, setImageFailed] = useState(false);
    const canShowImage = imageSrc && !imageFailed;

    return (
      <div
        onClick={onClick}
        className="w-full max-w-3xl cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md"
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className="flex gap-4 p-4">
          {onSelectChange ? (
            <label
              className="mt-1 flex h-5 w-5 flex-none items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => onSelectChange(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-gray-900"
              />
            </label>
          ) : null}

          {/* Image */}
          <div className="h-28 w-28 flex-none overflow-hidden rounded-xl bg-gray-100">
            {canShowImage ? (
              <img
                src={imageSrc}
                alt={imageAlt}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                No image
              </div>
            )}
          </div>
  
          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {title && (
                  <h3 className="truncate text-base font-semibold text-gray-900">
                    {title}
                  </h3>
                )}
                {(subtitle || date || location) && (
                  <p className="mt-0.5 truncate text-sm text-gray-500">
                    {subtitle}
                    {subtitle && (date || location) ? " • " : ""}
                    {date}
                    {date && location ? " • " : ""}
                    {location}
                  </p>
                )}
              </div>
  
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {confidenceScore !== undefined ? (
                  <ConfidenceBadge score={confidenceScore} size="sm" />
                ) : null}
                <span className="rounded-full border bg-gray-50 px-2 py-1 text-xs text-gray-600">
                  Record
                </span>
                {actionSlot ? (
                  <div
                    className="flex flex-wrap justify-end gap-1.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {actionSlot}
                  </div>
                ) : null}
              </div>
            </div>
  
            {/* Tags / Traits */}
            {traits?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {traits.map((t, idx) => {
                  const label = typeof t === "string" ? t : t.label;
                  const value = typeof t === "string" ? null : t.value;
  
                  return (
                    <span
                      key={`${label}-${idx}`}
                      className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 text-xs text-gray-700"
                      title={value ? `${label}: ${value}` : label}
                    >
                      <span className="font-medium">{label}</span>
                      {value ? (
                        <span className="text-gray-500">· {value}</span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

Record.propTypes = {
  imageSrc: PropTypes.string,
  imageAlt: PropTypes.string,
  title: PropTypes.string,
  subtitle: PropTypes.string,
  date: PropTypes.string,
  location: PropTypes.string,
  confidenceScore: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  selected: PropTypes.bool,
  onSelectChange: PropTypes.func,
  actionSlot: PropTypes.node,
  traits: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      }),
    ])
  ),
  onClick: PropTypes.func,
};
