import type { Place } from "./types";

/** Stub catalog around Denver midpoint (Slice 1 demo TZ: America/Denver). */
export const DENVER_PLACES: Place[] = [
  {
    name: "Tavernetta",
    cuisine: "italian",
    priceTier: 3,
    geo: { lat: 39.7532, lng: -105.0001 },
    neighborhood: "Union Station",
  },
  {
    name: "Hop Alley",
    cuisine: "chinese",
    priceTier: 2,
    geo: { lat: 39.7584, lng: -104.9844 },
    neighborhood: "RiNo",
  },
  {
    name: "Mercantile Dining & Provision",
    cuisine: "american",
    priceTier: 3,
    geo: { lat: 39.7528, lng: -105.0006 },
    neighborhood: "Union Station",
  },
  {
    name: "Cart-Driver",
    cuisine: "italian",
    priceTier: 2,
    geo: { lat: 39.7611, lng: -104.9823 },
    neighborhood: "RiNo",
  },
  {
    name: "Root Down",
    cuisine: "american",
    priceTier: 2,
    geo: { lat: 39.7622, lng: -105.0114 },
    neighborhood: "Highlands",
  },
];
