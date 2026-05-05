export const CONFIDENCE_THRESHOLD = 0.55;

const STRUCTURED_FIELDS = [
  "First Name",
  "Middle Name or Initial",
  "Last Name",
  "Military Unit",
  "Regiment Number",
  "Regiment State",
  "Branch",
  "Company",
  "Age",
  "Year Born",
  "Transcript",
  "Source",
];

function pickMetadata(source) {
  if (source === null || source === undefined || typeof source !== "object") return null;
  if (source.metadata && typeof source.metadata === "object") return source.metadata;
  return source;
}

function hasAnyStructuredField(metadata) {
  if (!metadata || typeof metadata !== "object") return false;
  for (const key of STRUCTURED_FIELDS) {
    const v = metadata[key];
    if (v === null || v === undefined) continue;
    if (typeof v === "number" && v !== 0) return true;
    if (typeof v === "string" && v.trim() !== "") return true;
  }
  const other = metadata.Other;
  if (other && typeof other === "object" && Object.keys(other).length > 0) return true;
  return false;
}

export function isDefaultEmptyMetadata(source) {
  const md = pickMetadata(source);
  if (!md) return true;
  const conf = md.Confidence;
  const confIsDefault = conf === 0 || conf === "" || conf === null || conf === undefined;
  return confIsDefault && !hasAnyStructuredField(md);
}

export function readConfidence(source) {
  if (source === null || source === undefined) return null;

  if (isDefaultEmptyMetadata(source)) return null;

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
  if (score === 0) return "unknown";
  return score < CONFIDENCE_THRESHOLD ? "flagged" : "passed";
}

export function formatConfidencePercent(score) {
  if (score === null || score === undefined) return "—";
  return `${Math.round(score * 100)}%`;
}
