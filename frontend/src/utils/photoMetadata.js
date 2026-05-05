import { isDefaultEmptyMetadata } from "./confidenceUtils";

const STRUCTURED_KEYS = [
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
  "Confidence",
  "Source",
];

function splitName(rawName) {
  if (!rawName || typeof rawName !== "string") return { first: "", middle: "", last: "" };

  const cleaned = rawName.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return { first: "", middle: "", last: "" };

  const parts = cleaned.split(" ");
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return {
    first: parts[0],
    last: parts[parts.length - 1],
    middle: parts.slice(1, -1).join(" "),
  };
}

function parseJsonObject(maybeJson) {
  if (!maybeJson || typeof maybeJson !== "string") return null;
  const trimmed = maybeJson.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function looksLikeFullMetadata(obj) {
  if (!obj || typeof obj !== "object") return false;
  return STRUCTURED_KEYS.some((key) => key in obj);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deriveMetadataForReview(photo) {
  if (!photo || typeof photo !== "object") return {};

  const existing = isPlainObject(photo.metadata) ? photo.metadata : {};

  // Path A: structured metadata column already populated — use it as-is.
  if (!isDefaultEmptyMetadata(existing)) {
    return existing;
  }

  const parsedNotes = parseJsonObject(photo.photoNotes);

  // Path B: photoNotes contains the full metadata JSON (legacy scraper output).
  // Hydrate every structured field from it, and treat its nested `Other` as the
  // real Other dict (instead of dumping the whole metadata into Other).
  if (looksLikeFullMetadata(parsedNotes)) {
    const merged = { ...existing };
    for (const key of STRUCTURED_KEYS) {
      if (key in parsedNotes && parsedNotes[key] !== undefined) {
        merged[key] = parsedNotes[key];
      }
    }
    merged.Other = isPlainObject(parsedNotes.Other) ? parsedNotes.Other : {};

    if (!merged["Military Unit"] && photo.regiment) merged["Military Unit"] = photo.regiment;
    if (!merged["Source"]) merged["Source"] = photo.imageUrl || "";

    if (!merged["First Name"] && !merged["Last Name"]) {
      const { first, middle, last } = splitName(photo.name);
      merged["First Name"] = first || "";
      merged["Middle Name or Initial"] = merged["Middle Name or Initial"] || middle || "";
      merged["Last Name"] = last || "";
    }

    return merged;
  }

  // Path C: photoNotes is empty, plain text, or just an Other dict.
  // Reconstruct from top-level columns and treat parsedNotes (if any) as Other.
  const { first, middle, last } = splitName(photo.name);
  return {
    ...existing,
    "First Name": existing["First Name"] || first || "",
    "Middle Name or Initial": existing["Middle Name or Initial"] || middle || "",
    "Last Name": existing["Last Name"] || last || "",
    "Military Unit": existing["Military Unit"] || photo.regiment || "",
    Transcript:
      existing.Transcript ||
      (typeof photo.photoNotes === "string" && !photo.photoNotes.trim().startsWith("{")
        ? photo.photoNotes
        : ""),
    Source: existing.Source || photo.imageUrl || "",
    Other: isPlainObject(existing.Other) && Object.keys(existing.Other).length > 0
      ? existing.Other
      : parsedNotes && isPlainObject(parsedNotes)
      ? parsedNotes
      : {},
  };
}
