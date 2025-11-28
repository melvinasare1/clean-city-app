export const SERVICE_AREAS = [
  "East Legon – Adjiringanor",
  "East Legon – Trasacco",
  "East Legon – ARS",
  "East Legon – American House",
  "East Legon – Bawaleshie",
  "East Legon - Ability",
  "East Legon - UPSA",
  "East Legon - Shiashie",
] as const;

export type ServiceArea = (typeof SERVICE_AREAS)[number];