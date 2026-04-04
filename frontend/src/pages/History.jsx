import { useState, useEffect } from "react";
import Record from "../components/Record";
import HistoryHeader from "../components/HistoryHeader";
import { getPhotos } from "../services/photoService";
import { useAuth } from "../hooks/useAuth";

export default function History() {
  const { user } = useAuth();
  const [photos,  setPhotos]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    getPhotos({ limit: 50 })
      .then((res) => setPhotos(res.data ?? []))
      .catch((err) => setError(err.message ?? "Failed to load photos."))
      .finally(() => setLoading(false));
  }, [user]);

  // Client-side search filter on name field
  const filtered = photos.filter((p) =>
    !search || (p.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <HistoryHeader
        onUpload={() => window.location.assign("/upload")}
        onSearchChange={(value) => setSearch(value)}
      />

      {!user && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">Sign in to view your photo history</p>
        </div>
      )}

      {user && loading && (
        <div className="mt-8 text-center text-sm text-gray-400">Loading photos…</div>
      )}

      {user && !loading && error && (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {user && !loading && !error && filtered.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-sm font-semibold text-gray-900">No photos found</p>
          <p className="mt-1 text-sm text-gray-500">
            Start a scrape on the Upload page to populate this list.
          </p>
        </div>
      )}

      {user && !loading && !error && filtered.map((photo, i) => (
        <div key={photo.id}>
          {i > 0 && <br />}
          <Record
            imageSrc={photo.imageUrl}
            title={photo.name ?? "Unnamed photo"}
            subtitle={photo.regiment ?? ""}
            date={photo.dateTaken ?? ""}
            location={photo.location ?? ""}
            traits={[
              ...(photo.tags ?? []),
              ...(photo.photographer ? [{ label: "Photographer", value: photo.photographer }] : []),
            ]}
            onClick={() => console.log("Open photo", photo.id)}
          />
        </div>
      ))}
    </div>
  );
}