import { NextResponse } from "next/server";
import { resolveSriLankaAuthority } from "@/lib/geo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOMINATIM_HEADERS = {
  "User-Agent": "CLEO-Citizen-Portal/1.0 (Sri Lanka Municipal Waste Reporting)",
  "Accept-Language": "en",
  Accept: "application/json",
};

interface NominatimReverseResponse {
  display_name?: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    state_district?: string;
  };
}

interface NominatimSearchItem {
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

function formatShortAddress(data: NominatimReverseResponse, lat: number, lon: number): string {
  const addr = data.address;
  if (addr) {
    const road = addr.road || addr.neighbourhood || addr.suburb;
    const locality = addr.city_district || addr.city || addr.town || addr.village || addr.state_district;
    const parts = [road, locality].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(", ");
    }
  }
  if (data.display_name) {
    return data.display_name.split(",").slice(0, 2).join(",").trim();
  }
  return `${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const latParam = searchParams.get("lat");
  const lonParam = searchParams.get("lon");

  // Forward search: /api/geocode?q=Galle+Road+Colombo
  if (query) {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("countrycodes", "lk");
      url.searchParams.set("limit", "5");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url.toString(), {
        headers: NOMINATIM_HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return NextResponse.json({ results: [] });
      }

      const items = (await res.json()) as NominatimSearchItem[];
      const results = items.map((item) => {
        const latitude = Number.parseFloat(item.lat);
        const longitude = Number.parseFloat(item.lon);
        const shortLabel =
          item.display_name.split(",").slice(0, 2).join(",").trim() ||
          item.name ||
          item.display_name;
        return {
          displayName: item.display_name,
          shortLabel,
          latitude,
          longitude,
          localAuthority: resolveSriLankaAuthority(
            latitude,
            longitude,
            item.display_name
          ),
        };
      });

      return NextResponse.json({ results });
    } catch {
      return NextResponse.json({ results: [] });
    }
  }

  // Reverse geocode: /api/geocode?lat=6.9271&lon=79.8612
  const latitude = Number.parseFloat(latParam ?? "");
  const longitude = Number.parseFloat(lonParam ?? "");

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return NextResponse.json(
      { error: "Provide either ?q=<search> or valid ?lat=<num>&lon=<num>." },
      { status: 400 }
    );
  }

  const fallbackAuthority = resolveSriLankaAuthority(latitude, longitude);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("zoom", "17");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url.toString(), {
      headers: NOMINATIM_HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({
        latitude,
        longitude,
        addressLabel: `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`,
        localAuthority: fallbackAuthority,
      });
    }

    const data = (await res.json()) as NominatimReverseResponse;
    const addressLabel = formatShortAddress(data, latitude, longitude);
    const localAuthority = resolveSriLankaAuthority(
      latitude,
      longitude,
      data.display_name || addressLabel
    );

    return NextResponse.json({
      latitude,
      longitude,
      addressLabel,
      localAuthority,
    });
  } catch {
    return NextResponse.json({
      latitude,
      longitude,
      addressLabel: `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`,
      localAuthority: fallbackAuthority,
    });
  }
}
