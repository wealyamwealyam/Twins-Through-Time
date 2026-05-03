export const CONFIDENCE_THRESHOLD = 0.55;

export function readConfidence(source) {
  if (source === null || source === undefined) return null;

  let raw = source;
  if (typeof raw === "object") {
    if (raw.metadata && typeof raw.metadata === "object") {
      raw = raw.metadata.Confidence;
    } else if ("Confidence" in raw) {
      raw = raw.Confidence;
    } else {
      return null;
    }
  }

  const num = typeof raw === "string" ? Number(raw) : raw;
  if (typeof num !== "number" || Number.isNaN(num)) return null;

  if (num > 1 && num <= 100) return num / 100;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

export function getConfidenceStatus(score) {
  if (score === null || score === undefined) return "unknown";
  return score < CONFIDENCE_THRESHOLD ? "flagged" : "passed";
}

export function formatConfidencePercent(score) {
  if (score === null || score === undefined) return "—";
  return `${Math.round(score * 100)}%`;
}
