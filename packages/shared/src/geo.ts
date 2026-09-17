/** Client display unit is miles (Aura Slice 2). API still stores km. */
export const KM_PER_MILE = 1.609344;
export const MILES_PER_KM = 0.621371;

export function kmToMiles(km: number): number {
  return Math.round(km * MILES_PER_KM * 10) / 10;
}

export function milesToKm(miles: number): number {
  return Math.max(1, Math.round(miles * KM_PER_MILE));
}

export function formatMilesFromKm(km: number): string {
  return kmToMiles(km).toFixed(1);
}
