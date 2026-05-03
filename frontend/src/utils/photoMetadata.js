import { isDefaultEmptyMetadata } from "./confidenceUtils";

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

function parseOther(photoNotes) {
  if (!photoNotes || typeof photoNotes !== "string") return null;
  const trimmed = photoNotes.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function deriveMetadataForReview(photo) {
  if (!photo || typeof photo !== "object") return {};

  const existing = photo.metadata && typeof photo.metadata === "object" ? photo.metadata : {};

  if (!isDefaultEmptyMetadata(existing)) {
    return existing;
  }

  const { first, middle, last } = splitName(photo.name);
  const otherFromNotes = parseOther(photo.photoNotes) || {};

  return {
    ...existing,
    "First Name": existing["First Name"] || first || "",
    "Middle Name or Initial": existing["Middle Name or Initial"] || middle || "",
    "Last Name": existing["Last Name"] || last || "",
    "Military Unit": existing["Military Unit"] || photo.regiment || "",
    "Transcript":
      existing["Transcript"] ||
      (typeof photo.photoNotes === "string" && !photo.photoNotes.trim().startsWith("{")
        ? photo.photoNotes
        : ""),
    "Source": existing["Source"] || photo.imageUrl || "",
    Other:
      existing.Other && typeof existing.Other === "object" && Object.keys(existing.Other).length > 0
        ? existing.Other
        : otherFromNotes,
  };
}
