import { suggestVenue } from "./logic";
import type {
  Place,
  SuggestVenueInput,
  SuggestVenueResult,
  UserProfileSnapshot,
  VenueSuggester,
} from "./types";

export type PlaceProvider = {
  /** Places near a midpoint. Empty is valid (→ venue_unavailable). */
  findPlaces(input: {
    midpoint: { lat: number; lng: number };
    cuisine: string[];
    maxBudget: 1 | 2 | 3 | 4;
    maxTravelKm: number;
  }): Promise<Place[]>;
};

export function createCatalogPlaceProvider(places: Place[]): PlaceProvider {
  return {
    async findPlaces() {
      return places;
    },
  };
}

/**
 * Google Places (New) nearby search. No-ops without an API key.
 * Forge owns keys; Nexus owns filter/rank via suggestVenue.
 */
export function createGooglePlaceProvider(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
}): PlaceProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async findPlaces(input) {
      const res = await fetchImpl("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": options.apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.location,places.priceLevel,places.primaryType,places.shortFormattedAddress",
        },
        body: JSON.stringify({
          includedTypes: ["restaurant"],
          maxResultCount: 10,
          locationRestriction: {
            circle: {
              center: { latitude: input.midpoint.lat, longitude: input.midpoint.lng },
              radius: Math.min(Math.max(input.maxTravelKm, 1), 30) * 1000,
            },
          },
        }),
      });
      if (!res.ok) return [];
      const body = (await res.json()) as {
        places?: Array<{
          displayName?: { text?: string };
          location?: { latitude?: number; longitude?: number };
          priceLevel?: string;
          primaryType?: string;
          shortFormattedAddress?: string;
        }>;
      };
      return (body.places ?? [])
        .map((p): Place | null => {
          const lat = p.location?.latitude;
          const lng = p.location?.longitude;
          if (lat == null || lng == null) return null;
          return {
            name: p.displayName?.text ?? "Restaurant",
            cuisine: cuisineFromType(p.primaryType),
            priceTier: priceFromGoogle(p.priceLevel, input.maxBudget),
            geo: { lat, lng },
            neighborhood: neighborhoodFromAddress(p.shortFormattedAddress),
          };
        })
        .filter((x): x is Place => x !== null);
    },
  };
}

function cuisineFromType(type: string | undefined): string {
  if (!type) return "american";
  if (type.includes("italian")) return "italian";
  if (type.includes("chinese")) return "chinese";
  if (type.includes("japanese") || type.includes("ramen")) return "ramen";
  if (type.includes("mexican")) return "mexican";
  return "american";
}

function priceFromGoogle(level: string | undefined, fallback: 1 | 2 | 3 | 4): 1 | 2 | 3 | 4 {
  switch (level) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return fallback;
  }
}

function neighborhoodFromAddress(addr: string | undefined): string {
  if (!addr) return "Midpoint";
  const parts = addr.split(",").map((s) => s.trim());
  return parts[1] ?? parts[0] ?? "Midpoint";
}

function asSnapshot(u: SuggestVenueInput["userA"]): UserProfileSnapshot {
  return {
    looking_for: "unsure",
    age: 30,
    gender: "unspecified",
    interested_in: [],
    homeGeo: u.homeGeo,
    cuisine: u.cuisine,
    budget: u.budget,
    maxTravelKm: u.maxTravelKm,
    dealbreakers: [],
    interests: [],
    vibeTags: [],
  };
}

/** Prod: GOOGLE_PLACES_API_KEY is required behind VenueSuggester (seed catalog is local/demo). */
export function assertPlacesKeyInProd(
  env: { NODE_ENV?: string; GOOGLE_PLACES_API_KEY?: string },
  options?: { empty?: boolean }
): void {
  if (options?.empty) return;
  if (env.NODE_ENV === "production" && !env.GOOGLE_PLACES_API_KEY) {
    throw new Error(
      "GOOGLE_PLACES_API_KEY required when NODE_ENV=production (VenueSuggester). Seed catalog is local/demo only."
    );
  }
}

/**
 * Real mid-point VenueSuggester: provider fetch → Nexus filter
 * (mid ∩ maxTravelKm ∩ cuisine ∩ budget → ≤3). Empty candidates are valid.
 */
export function createMidpointVenueSuggester(options: {
  provider: PlaceProvider;
  empty?: boolean;
}): VenueSuggester {
  return {
    async suggestVenue(input: SuggestVenueInput): Promise<SuggestVenueResult> {
      if (options.empty) return { candidates: [] };
      const mid = {
        lat: (input.userA.homeGeo.lat + input.userB.homeGeo.lat) / 2,
        lng: (input.userA.homeGeo.lng + input.userB.homeGeo.lng) / 2,
      };
      const maxBudget = Math.min(input.userA.budget, input.userB.budget) as 1 | 2 | 3 | 4;
      const cuisine = [
        ...new Set(
          [...input.userA.cuisine, ...input.userB.cuisine].map((c) => c.toLowerCase())
        ),
      ];
      const maxTravelKm = Math.max(input.userA.maxTravelKm, input.userB.maxTravelKm);
      let places: Place[] = [];
      try {
        places = await options.provider.findPlaces({
          midpoint: mid,
          cuisine,
          maxBudget,
          maxTravelKm,
        });
      } catch {
        places = [];
      }
      const candidates = suggestVenue({
        a: asSnapshot(input.userA),
        b: asSnapshot(input.userB),
        places,
      });
      return { candidates };
    },
  };
}
