import PropTypes from "prop-types";

import {
  CONFIDENCE_THRESHOLD,
  formatConfidencePercent,
  getConfidenceStatus,
} from "../utils/confidenceUtils";

const SIZES = {
  sm: "px-2 py-0.5 text-[11px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

const STATUS_STYLES = {
  flagged: {
    container: "border-red-200 bg-red-50 text-red-800",
    dot: "bg-red-500",
    label: "Flagged for review",
  },
  passed: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
    label: "Passed",
  },
  unknown: {
    container: "border-gray-200 bg-gray-50 text-gray-600",
    dot: "bg-gray-400",
    label: "No score",
  },
};

export default function ConfidenceBadge({ score, size = "md", showLabel = true, className = "" }) {
  const status = getConfidenceStatus(score);
  const styles = STATUS_STYLES[status];
  const sizeClasses = SIZES[size] ?? SIZES.md;

  const tooltip =
    status === "unknown"
      ? "AI confidence is not available for this photo."
      : `AI confidence: ${formatConfidencePercent(score)} (threshold ${Math.round(
          CONFIDENCE_THRESHOLD * 100
        )}%).`;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${styles.container} ${sizeClasses} ${className}`}
      title={tooltip}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
      <span>AI {formatConfidencePercent(score)}</span>
      {showLabel ? <span className="opacity-80">· {styles.label}</span> : null}
    </span>
  );
}

ConfidenceBadge.propTypes = {
  score: PropTypes.number,
  size: PropTypes.oneOf(["sm", "md"]),
  showLabel: PropTypes.bool,
  className: PropTypes.string,
};
