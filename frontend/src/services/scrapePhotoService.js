import { CONFIDENCE_THRESHOLD } from "../utils/confidenceUtils";
import { apiBlobRequest, apiRequest } from "../utils/apiClient";

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadScrapePhotos(scrapeJobId, filter, photoIds = []) {
  const fallbackName = `scrape-job-${scrapeJobId}-${filter}-photos.zip`;
  const { blob, filename } = await apiBlobRequest(
    `/scrape-jobs/${encodeURIComponent(scrapeJobId)}/photos/download`,
    {
      method: "POST",
      body: JSON.stringify({
        filter,
        threshold: CONFIDENCE_THRESHOLD,
        photoIds,
      }),
    }
  );

  saveBlob(blob, filename || fallbackName);
  return filename || fallbackName;
}

export function deleteScrapePhotos(scrapeJobId, filter, photoIds = []) {
  return apiRequest(`/scrape-jobs/${encodeURIComponent(scrapeJobId)}/photos`, {
    method: "DELETE",
    body: JSON.stringify({
      filter,
      threshold: CONFIDENCE_THRESHOLD,
      photoIds,
    }),
  });
}
