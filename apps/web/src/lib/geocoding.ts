// Free, keyless, CORS-enabled geocoding so the location pickers can search
// any city worldwide instead of a fixed shortlist.
export interface CitySuggestion {
  label: string;
  lat: number;
  lng: number;
}

interface OpenMeteoResult {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
}

// Open-Meteo's geocoding API (https://open-meteo.com/en/docs/geocoding-api) -
// forward search by name, no API key or registration required.
export async function searchCities(query: string, signal?: AbortSignal): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data: { results?: OpenMeteoResult[] } = await res.json();
  return (data.results ?? []).map((r) => ({
    label: [r.name, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lng: r.longitude,
  }));
}

interface BigDataCloudReverse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

// BigDataCloud's free client-side reverse-geocoding endpoint - turns a raw GPS
// fix into a human-readable label, worldwide, no API key required.
export async function reverseGeocodeCity(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: BigDataCloudReverse = await res.json();
    const city = data.city || data.locality;
    if (!city) return null;
    return [city, data.countryName].filter(Boolean).join(", ");
  } catch {
    return null;
  }
}
