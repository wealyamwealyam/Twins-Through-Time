import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

const AGE_OPTIONS = [
  "Unknown",
  "Infant",
  "Child",
  "Teen",
  "20s",
  "30s",
  "40s",
  "50s",
  "60s",
  "70+",
];

const AFFILIATION_OPTIONS = [
  "Unknown",
  "Union",
  "Confederate",
  "Civilian",
  "Other",
];

const RACE_OPTIONS = [
  "Unknown",
  "White",
  "Black",
  "Asian",
  "Native American",
  "Mixed",
  "Other",
];

const SEX_OPTIONS = [
  "Unknown",
  "Male",
  "Female",
  "Other",
];

const DEFAULT_FLAGS = {
  hat: false,
  glasses: false,
  cane: false,
};

function buildInitialAnnotation(image, index) {
  return {
    id: image.id ?? `record-${index + 1}`,
    imageSrc: image.src,
    fileName: image.fileName ?? image.src?.split("/").pop() ?? `image-${index + 1}`,
    metadata: {
      name: image.name ?? "",
      ageRange: "Unknown",
      affiliation: "Unknown",
      race: "Unknown",
      sex: "Unknown",
      accessories: { ...DEFAULT_FLAGS },
      notes: image.photoNotes ?? "",
    },
  };
}

export default function MetadataReviewPopup({ images = [], isOpen, onClose, onSave }) {
  const initialData = useMemo(
    () => images.map((img, idx) => buildInitialAnnotation(img, idx)),
    [images]
  );

  const [annotations, setAnnotations] = useState(initialData);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAnnotations(initialData);
    setCurrentIndex(0);
    setSaveMessage("");
  }, [initialData, isOpen]);

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

  const current = annotations[currentIndex];
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

  const jsonPreview = JSON.stringify(annotations, null, 2);

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

  const updateAccessory = (field, value) => {
    setAnnotations((prev) =>
      prev.map((item, idx) =>
        idx === currentIndex
          ? {
              ...item,
              metadata: {
                ...item.metadata,
                accessories: {
                  ...item.metadata.accessories,
                  [field]: value,
                },
              },
            }
          : item
      )
    );
  };

  const goPrev = () => setCurrentIndex((prev) => Math.max(prev - 1, 0));
  const goNext = () =>
    setCurrentIndex((prev) => Math.min(prev + 1, annotations.length - 1));

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

  const progress = `${currentIndex + 1} / ${annotations.length}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-7xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* IMAGE */}
        <div className="flex w-[32%] items-center justify-center bg-gray-100 p-6">
          <img
            src={current.imageSrc}
            alt={current.fileName}
            className="max-h-full max-w-full rounded-xl object-contain shadow"
          />
        </div>

        {/* FORM */}
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
            <div className="grid gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  value={current.metadata.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Enter identified name if known"
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Age range
                </label>
                <select
                  value={current.metadata.ageRange}
                  onChange={(e) => updateField("ageRange", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                >
                  {AGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Affiliation
                </label>
                <select
                  value={current.metadata.affiliation}
                  onChange={(e) => updateField("affiliation", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                >
                  {AFFILIATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Race
                </label>
                <select
                  value={current.metadata.race}
                  onChange={(e) => updateField("race", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                >
                  {RACE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Sex
                </label>
                <select
                  value={current.metadata.sex}
                  onChange={(e) => updateField("sex", e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                >
                  {SEX_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Visible accessories / features
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      checked={current.metadata.accessories.hat}
                      onChange={(e) => updateAccessory("hat", e.target.checked)}
                    />
                    <span className="text-sm">Hat</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      checked={current.metadata.accessories.glasses}
                      onChange={(e) => updateAccessory("glasses", e.target.checked)}
                    />
                    <span className="text-sm">Glasses</span>
                  </label>

                  <label className="flex items-center gap-2 rounded-lg border p-3">
                    <input
                      type="checkbox"
                      checked={current.metadata.accessories.cane}
                      onChange={(e) => updateAccessory("cane", e.target.checked)}
                    />
                    <span className="text-sm">Cane</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={current.metadata.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={4}
                  placeholder="Any extra notes or uncertainty..."
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  AI Summary
                </label>
                <textarea
                  value={"AI-generated summary connection TODO"}
                  readOnly
                  className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 resize-none focus:outline-none"
                  rows={4}
                />
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

        {/* JSON SIDEBAR */}
        <aside className="flex w-[30%] flex-col bg-gray-950 text-gray-100">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-sm font-semibold">JSON Preview</h3>
            <p className="mt-1 text-xs text-gray-400">
                debug and demo purposes - LIVE
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
      id: PropTypes.string,
      src: PropTypes.string,
      fileName: PropTypes.string,
      name: PropTypes.string,
      photoNotes: PropTypes.string,
    })
  ),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
};
