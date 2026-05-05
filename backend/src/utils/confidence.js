export const CONFIDENCE_THRESHOLD = 0.55;

const STRUCTURED_FIELDS = [
  'First Name',
  'Middle Name or Initial',
  'Last Name',
  'Military Unit',
  'Regiment Number',
  'Regiment State',
  'Branch',
  'Company',
  'Age',
  'Year Born',
  'Transcript',
  'Source',
];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function hasAnyStructuredField(metadata) {
  if (!isPlainObject(metadata)) return false;

  for (const key of STRUCTURED_FIELDS) {
    const value = metadata[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'number' && value !== 0) return true;
    if (typeof value === 'string' && value.trim() !== '') return true;
  }

  return isPlainObject(metadata.Other) && Object.keys(metadata.Other).length > 0;
}

export function isDefaultEmptyMetadata(source) {
  const metadata = isPlainObject(source?.metadata) ? source.metadata : source;
  if (!isPlainObject(metadata)) return true;

  const confidence = metadata.Confidence;
  const confidenceIsDefault =
    confidence === 0 ||
    confidence === '' ||
    confidence === null ||
    confidence === undefined;

  return confidenceIsDefault && !hasAnyStructuredField(metadata);
}

export function readConfidence(source) {
  if (source === null || source === undefined) return null;
  if (isDefaultEmptyMetadata(source)) return null;

  let raw = source;
  if (isPlainObject(raw)) {
    if (isPlainObject(raw.metadata)) {
      raw = raw.metadata.Confidence;
    } else if (Object.prototype.hasOwnProperty.call(raw, 'Confidence')) {
      raw = raw.Confidence;
    } else {
      return null;
    }
  }

  const num = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof num !== 'number' || Number.isNaN(num)) return null;
  if (num > 1 && num <= 100) return num / 100;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

export function normalizeConfidenceThreshold(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 && num <= 1 ? num : CONFIDENCE_THRESHOLD;
}

export function getConfidenceStatus(score, threshold = CONFIDENCE_THRESHOLD) {
  if (score === null || score === undefined) return 'unknown';
  if (score === 0) return 'unknown';
  return score < threshold ? 'flagged' : 'passed';
}

export function getPhotoConfidenceStatus(photo, threshold = CONFIDENCE_THRESHOLD) {
  const score = readConfidence(photo?.metadata) ?? readConfidence(photo?.scrapedMetadata);
  return getConfidenceStatus(score, threshold);
}
