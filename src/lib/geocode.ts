// Mapbox Geocoding — turns a place / building string into coordinates so the
// command bar can fly the map anywhere the user asks for. Live, uses the same
// token as the map.

export interface GeoResult {
  name: string;
  placeName: string;
  center: [number, number];
  bbox?: [number, number, number, number];
}

export async function geocode(query: string, token: string): Promise<GeoResult | null> {
  const q = query.trim();
  if (!q) return null;

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?access_token=${token}&limit=1&language=en` +
    // bias toward London but don't hard-restrict — "Shard" etc. still resolve
    `&proximity=-0.1276,51.5072`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as {
    features?: Array<{
      text?: string;
      place_name?: string;
      center?: [number, number];
      bbox?: [number, number, number, number];
    }>;
  };

  const f = data.features?.[0];
  if (!f?.center) return null;

  return {
    name: f.text ?? q,
    placeName: f.place_name ?? q,
    center: f.center,
    bbox: f.bbox,
  };
}

/**
 * Reverse geocode a map click into a readable building name + address. Prefers a
 * named POI/address feature at the point; always returns *something* (falls back
 * to the coordinates) so any building on the map is selectable.
 */
export async function reverseGeocode(
  lng: number,
  lat: number,
  token: string,
): Promise<GeoResult> {
  const fallback: GeoResult = {
    name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    placeName: `Dropped pin · ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    center: [lng, lat],
  };

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
      `?access_token=${token}&limit=1&language=en&types=poi,address`;
    const res = await fetch(url);
    if (!res.ok) return fallback;

    const data = (await res.json()) as {
      features?: Array<{ text?: string; place_name?: string; center?: [number, number] }>;
    };
    const f = data.features?.[0];
    if (!f) return fallback;

    return {
      // Keep the clicked point as the anchor — the geocoder's center can drift to
      // the street/POI centroid, but we want the building the user actually hit.
      name: f.text ?? fallback.name,
      placeName: f.place_name ?? fallback.placeName,
      center: [lng, lat],
    };
  } catch {
    return fallback;
  }
}
