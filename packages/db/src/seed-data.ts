import { randomUUID } from "node:crypto";
import { venueCatalog } from "./schema";
import type { SparkDb } from "./client";

/** Sample Denver venue DB used when no Places API key is configured. */
export const DENVER_CATALOG = [
  {
    name: "Tavernetta",
    cuisine: "italian",
    priceTier: 3 as const,
    approxNeighborhood: "Union Station",
    lat: 39.7532,
    lng: -105.0001,
  },
  {
    name: "Hop Alley",
    cuisine: "chinese",
    priceTier: 2 as const,
    approxNeighborhood: "RiNo",
    lat: 39.7584,
    lng: -104.9844,
  },
  {
    name: "Mercantile Dining & Provision",
    cuisine: "american",
    priceTier: 3 as const,
    approxNeighborhood: "Union Station",
    lat: 39.7528,
    lng: -105.0006,
  },
  {
    name: "Cart-Driver",
    cuisine: "italian",
    priceTier: 2 as const,
    approxNeighborhood: "RiNo",
    lat: 39.7611,
    lng: -104.9823,
  },
  {
    name: "Root Down",
    cuisine: "american",
    priceTier: 2 as const,
    approxNeighborhood: "Highlands",
    lat: 39.7622,
    lng: -105.0114,
  },
  {
    name: "Uncle",
    cuisine: "ramen",
    priceTier: 2 as const,
    approxNeighborhood: "LoHi",
    lat: 39.7621,
    lng: -105.0118,
  },
];

export async function seedVenueCatalog(db: SparkDb): Promise<number> {
  const existing = await db.select({ id: venueCatalog.id }).from(venueCatalog);
  if (existing.length > 0) return existing.length;
  await db.insert(venueCatalog).values(
    DENVER_CATALOG.map((row) => ({
      id: randomUUID(),
      name: row.name,
      cuisine: row.cuisine,
      priceTier: row.priceTier,
      approxNeighborhood: row.approxNeighborhood,
      lat: row.lat,
      lng: row.lng,
      source: "catalog",
    }))
  );
  return DENVER_CATALOG.length;
}

export const DEMO_ACCOUNTS = {
  maya: {
    email: "maya@softspark.dev",
    password: "spark-demo-maya",
    name: "Maya",
  },
  jordan: {
    email: "jordan@softspark.dev",
    password: "spark-demo-jordan",
    name: "Jordan",
  },
} as const;
