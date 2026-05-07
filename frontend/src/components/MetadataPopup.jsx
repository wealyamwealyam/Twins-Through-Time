import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";

import ConfidenceBadge from "./ConfidenceBadge";
import {
  CONFIDENCE_THRESHOLD,
  formatConfidencePercent,
  getConfidenceStatus,
  readConfidence,
} from "../utils/confidenceUtils";

const FIXED_FIELDS = [
  { key: "First Name", type: "text" },
  { key: "Middle Name or Initial", type: "text" },
  { key: "Last Name", type: "text" },
  { key: "Military Unit", type: "text" },
  { key: "Regiment Number", type: "text" },
  { key: "Regiment State", type: "text" },
  { key: "Branch", type: "text" },
  { key: "Company", type: "text" },
  { key: "Age", type: "number" },
  { key: "Year Born", type: "number" },
  { key: "Transcript", type: "textarea" },
  { key: "Confidence", type: "number", step: "0.01" },
  { key: "Source", type: "text" },
];

const EMPTY_METADATA = {
  "First Name": "",
  "Middle Name or Initial": "",
  "Last Name": "",
  "Military Unit": "",
  "Regiment Number": "",
  "Regiment State": "",
  Branch: "",
  Company: "",
  Age: "",
  "Year Born": "",
  Transcript: "",
  Confidence: "",
  Source: "",
  Other: {},
};

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeMetadata(rawMetadata = {}) {
  const parsed = safeParseJson(rawMetadata) || {};
  const normalized = {
    ...EMPTY_METADATA,
    ...parsed,
    Other:
      parsed?.Other && typeof parsed.Other === "object" && !Array.isArray(parsed.Other)
        ? parsed.Other
        : {},
  };

  return normalized;
}

function buildInitialAnnotation(image, index) {
  const scrapedMetadata =
    image.scrapedMetadata ||
    image.metadata ||
    image.metadataJson ||
    image.finalMetadata ||
    {};

  return {
    id: image.id ?? `record-${index + 1}`,
    imageSrc: image.src,
    fileName:
      image.fileName ?? image.src?.split("/").pop() ?? `image-${index + 1}`,
    metadata: normalizeMetadata(scrapedMetadata),
  };
}

function clampIndex(index, length) {
  if (length <= 0) return 0;

  const safeIndex = Number.isFinite(index) ? index : 0;
  return Math.min(Math.max(safeIndex, 0), length - 1);
}

function idsMatch(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return String(left) === String(right);
}

function resolveInitialIndex(annotations, initialIndex, initialImageId) {
  const idIndex = annotations.findIndex((item) =>
    idsMatch(item.id, initialImageId)
  );

  return idIndex >= 0 ? idIndex : clampIndex(initialIndex, annotations.length);
}

export default function MetadataReviewPopup({
  images = [],
  initialIndex = 0,
  initialImageId = null,
  isOpen,
  onClose,
  onSave,
}) {
  const initialData = useMemo(
    () => images.map((img, idx) => buildInitialAnnotation(img, idx)),
    [images]
  );

  const [annotations, setAnnotations] = useState(() => initialData);
  const [currentIndex, setCurrentIndex] = useState(() =>
    resolveInitialIndex(initialData, initialIndex, initialImageId)
  );
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const current = annotations[currentIndex];
  const currentIdRef = useRef(null);

  useEffect(() => {
    currentIdRef.current = current?.id ?? null;
  }, [current?.id]);

  useEffect(() => {
    if (!isOpen) return;

    if (initialData.length === 0) {
      onClose();
      return;
    }

    const activeId = currentIdRef.current;

    setAnnotations((previous) => {
      const previousById = new Map(previous.map((item) => [String(item.id), item]));

      return initialData.map((incoming) => {
        const previousItem = previousById.get(String(incoming.id));

        return previousItem
          ? {
              ...incoming,
              metadata: previousItem.metadata,
            }
          : incoming;
      });
    });

    setCurrentIndex((previous) => {
      const activeIndex = initialData.findIndex((item) =>
        idsMatch(item.id, activeId)
      );

      return activeIndex >= 0
        ? activeIndex
        : clampIndex(previous, initialData.length);
    });
  }, [initialData, isOpen, onClose]);

  if (!isOpen) return null;

  if (!images.length) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold">No images to review</h2>
          <p className="mt-2 text-sm text-gray-600">
            Pass an array of image objects into the component.
          </p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-semibold">No image selected</h2>
          <p className="mt-2 text-sm text-gray-600">
            Close this window and choose a photo again.
          </p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-white"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const jsonPreview = JSON.stringify(current.metadata, null, 2);
  const progress = `${currentIndex + 1} / ${annotations.length}`;

  const updateField = (field, value) => {
    setAnnotations((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex
          ? {
              ...item,
              metadata: {
                ...item.metadata,
                [field]: value,
              },
            }
          : item
      )
    );
  };

  const updateOtherField = (otherKey, value) => {
    setAnnotations((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex
          ? {
              ...item,
              metadata: {
                ...item.metadata,
                Other: {
                  ...(item.metadata.Other || {}),
                  [otherKey]: value,
                },
              },
            }
          : item
      )
    );
  };

  const renameOtherField = (oldKey, newKey) => {
    if (!newKey || oldKey === newKey) return;

    setAnnotations((prev) =>
      prev.map((item, idx) => {
        if (idx !== currentIndex) return item;

        const currentOther = { ...(item.metadata.Other || {}) };
        const existingValue = currentOther[oldKey];
        delete currentOther[oldKey];
        currentOther[newKey] = existingValue;

        return {
          ...item,
          metadata: {
            ...item.metadata,
            Other: currentOther,
          },
        };
      })
    );
  };

  const removeOtherField = (otherKey) => {
    setAnnotations((prev) =>
      prev.map((item, idx) => {
        if (idx !== currentIndex) return item;

        const currentOther = { ...(item.metadata.Other || {}) };
        delete currentOther[otherKey];

        return {
          ...item,
          metadata: {
            ...item.metadata,
            Other: currentOther,
          },
        };
      })
    );
  };

  const addOtherField = () => {
    setAnnotations((prev) =>
      prev.map((item, idx) => {
        if (idx !== currentIndex) return item;

        const currentOther = { ...(item.metadata.Other || {}) };
        let counter = 1;
        let nextKey = `other${counter}`;

        while (Object.prototype.hasOwnProperty.call(currentOther, nextKey)) {
          counter += 1;
          nextKey = `other${counter}`;
        }

        currentOther[nextKey] = "";

        return {
          ...item,
          metadata: {
            ...item.metadata,
            Other: currentOther,
          },
        };
      })
    );
  };

  const goPrev = () => {
    setSaveMessage("");
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const goNext = () => {
    setSaveMessage("");
    setCurrentIndex((prev) =>
      prev < annotations.length - 1 ? prev + 1 : prev
    );
  };

  const saveCurrent = async () => {
    if (!onSave) {
      setSaveMessage("No save handler is connected.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");

    try {
      await onSave(current);
      setSaveMessage("Saved metadata.");
    } catch (error) {
      setSaveMessage(error?.message || "Unable to save metadata.");
    } finally {
      setIsSaving(false);
    }
  };

  const otherEntries = Object.entries(current.metadata.Other || {});
  const currentScore = readConfidence(current.metadata);
  const currentStatus = getConfidenceStatus(currentScore);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex w-[32%] items-center justify-center bg-gray-100 p-6">
          <img
            src={current.imageSrc}
            alt={current.fileName}
            className="max-h-full max-w-full rounded-xl object-contain shadow"
          />
        </div>

        <div className="flex w-[38%] flex-col border-l border-r">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-xl font-semibold">Manual Metadata Review</h2>
              <p className="text-sm text-gray-500">
                Reviewing {current.fileName} · {progress}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div
              className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${
                currentStatus === "flagged"
                  ? "border-red-200 bg-red-50"
                  : currentStatus === "passed"
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-gray-200 bg-gray-50"
              }`}
            >
              <ConfidenceBadge score={currentScore} size="md" />
              <div className="text-xs leading-relaxed text-gray-700">
                {currentStatus === "flagged" ? (
                  <span>
                    AI confidence is{" "}
                    <strong>{formatConfidencePercent(currentScore)}</strong>, below the{" "}
                    {Math.round(CONFIDENCE_THRESHOLD * 100)}% threshold. This photo is
                    flagged — please verify and correct the metadata before saving.
                  </span>
                ) : currentStatus === "passed" ? (
                  <span>
                    AI confidence is{" "}
                    <strong>{formatConfidencePercent(currentScore)}</strong>. This photo
                    passed the {Math.round(CONFIDENCE_THRESHOLD * 100)}% threshold; you can
                    still adjust any field below.
                  </span>
                ) : (
                  <span>
                    AI confidence is unavailable for this record. Review the metadata
                    manually before saving.
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4">
              {FIXED_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {field.key}
                  </label>

                  {field.type === "textarea" ? (
                    <textarea
                      value={current.metadata[field.key] ?? ""}
                      onChange={(e) => updateField(field.key, e.target.value)}
                      rows={4}
                      className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                    />
                  ) : (
                      <input
                        type={field.type}
                        step={field.step}
                        value={current.metadata[field.key] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const value =
                            field.type === "number"
                              ? (raw === "" ? "" : Number(raw))
                              : raw;

                          updateField(field.key, value);
                        }}
                        className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                      />
                  )}
                </div>
              ))}

              <div className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Other</h3>
                    <p className="text-xs text-gray-500">
                      Dynamic metadata fields from the scrape
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addOtherField}
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-gray-50"
                  >
                    + Add field
                  </button>
                </div>

                {otherEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">No extra fields found.</p>
                ) : (
                  <div className="space-y-3">
                    {otherEntries.map(([otherKey, otherValue]) => (
                      <div key={otherKey} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                        <input
                          type="text"
                          value={otherKey}
                          onChange={(e) => renameOtherField(otherKey, e.target.value)}
                          placeholder="Field name"
                          className="rounded-lg border px-3 py-2 outline-none focus:ring"
                        />
                        <input
                          type="text"
                          value={otherValue ?? ""}
                          onChange={(e) => updateOtherField(otherKey, e.target.value)}
                          placeholder="Field value"
                          className="rounded-lg border px-3 py-2 outline-none focus:ring"
                        />
                        <button
                          type="button"
                          onClick={() => removeOtherField(otherKey)}
                          className="rounded-lg border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t px-6 py-4">
            <div className="flex gap-2">
              <button
                onClick={goPrev}
                disabled={currentIndex === 0}
                className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={goNext}
                disabled={currentIndex === annotations.length - 1}
                className="rounded-lg border px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>

            <div className="flex items-center gap-3">
              {saveMessage ? (
                <span className="text-xs text-gray-500">{saveMessage}</span>
              ) : null}

              <button
                type="button"
                onClick={saveCurrent}
                disabled={isSaving}
                className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save metadata"}
              </button>
            </div>
          </div>
        </div>

        <aside className="flex w-[30%] flex-col bg-gray-950 text-gray-100">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold">JSON Preview</h3>
            <p className="mt-1 text-xs text-gray-400">
              Current image metadata - live
            </p>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <pre className="whitespace-pre-wrap break-words text-xs leading-5">
              {jsonPreview}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}

MetadataReviewPopup.propTypes = {
  images: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      src: PropTypes.string,
      fileName: PropTypes.string,
      scrapedMetadata: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
      metadata: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
      metadataJson: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
      finalMetadata: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
    })
  ),
  initialIndex: PropTypes.number,
  initialImageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
};

