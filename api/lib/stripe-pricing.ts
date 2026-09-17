/**
 * Stripe presentation price: live FX, then Clean City 2% card payment surcharge.
 * Does not claim the 2% equals Stripe's fees.
 */

import type { StripeChargeCurrency } from "./stripe-currency";
import {
  convertGhsToStripeCurrency,
  fromMinorUnits,
  toMinorUnits,
  type GhsFxConversion,
} from "./stripe-fx";

export const STRIPE_SURCHARGE_PERCENT = 2;

export type StripePriceSnapshot = {
  sourceAmountGhs: number;
  sourceCurrency: "GHS";
  stripeCurrency: StripeChargeCurrency;
  exchangeRate: number;
  fxProvider: string;
  fxTimestamp: string;
  convertedAmount: number;
  stripeSurchargePercent: number;
  stripeSurchargeAmount: number;
  finalStripeAmount: number;
  stripeAmountMinor: number;
};

export function applyStripePaymentSurchargeMinor(
  convertedMinor: number,
  percent = STRIPE_SURCHARGE_PERCENT
): { surchargeMinor: number; finalMinor: number } {
  if (!Number.isFinite(convertedMinor) || convertedMinor <= 0) {
    throw new Error("Converted amount is invalid");
  }
  const finalMinor = Math.round((convertedMinor * (100 + percent)) / 100);
  return {
    surchargeMinor: finalMinor - convertedMinor,
    finalMinor,
  };
}

export function snapshotFromConversion(
  conversion: GhsFxConversion,
  percent = STRIPE_SURCHARGE_PERCENT
): StripePriceSnapshot {
  const { surchargeMinor, finalMinor } = applyStripePaymentSurchargeMinor(
    conversion.convertedAmountMinor,
    percent
  );
  return {
    sourceAmountGhs: conversion.sourceAmountGhs,
    sourceCurrency: "GHS",
    stripeCurrency: conversion.targetCurrency,
    exchangeRate: conversion.exchangeRate,
    fxProvider: conversion.provider,
    fxTimestamp: conversion.rateTimestamp,
    convertedAmount: conversion.convertedAmount,
    stripeSurchargePercent: percent,
    stripeSurchargeAmount: fromMinorUnits(surchargeMinor),
    finalStripeAmount: fromMinorUnits(finalMinor),
    stripeAmountMinor: finalMinor,
  };
}

export async function buildStripePriceSnapshot(
  amountGhs: number,
  targetCurrency: StripeChargeCurrency,
  options?: Parameters<typeof convertGhsToStripeCurrency>[2]
): Promise<StripePriceSnapshot> {
  const conversion = await convertGhsToStripeCurrency(
    amountGhs,
    targetCurrency,
    options
  );
  return snapshotFromConversion(conversion);
}

export function stripePriceSnapshotFields(
  snapshot: StripePriceSnapshot
): Record<string, unknown> {
  return {
    sourceAmountGhs: snapshot.sourceAmountGhs,
    sourceCurrency: snapshot.sourceCurrency,
    stripeCurrency: snapshot.stripeCurrency,
    exchangeRate: snapshot.exchangeRate,
    fxProvider: snapshot.fxProvider,
    fxTimestamp: snapshot.fxTimestamp,
    convertedAmount: snapshot.convertedAmount,
    stripeSurchargePercent: snapshot.stripeSurchargePercent,
    stripeSurchargeAmount: snapshot.stripeSurchargeAmount,
    finalStripeAmount: snapshot.finalStripeAmount,
    stripeAmountMinor: snapshot.stripeAmountMinor,
  };
}

export function lockedSnapshotFromRecord(
  data: Record<string, unknown> | undefined,
  fallbackGhs: number
): StripePriceSnapshot | null {
  if (!data) return null;
  const currency = String(data.stripeCurrency || "").toUpperCase();
  const minor = Number(data.stripeAmountMinor);
  if (!currency || !Number.isFinite(minor) || minor <= 0) return null;
  return {
    sourceAmountGhs: Number(data.sourceAmountGhs) || fallbackGhs,
    sourceCurrency: "GHS",
    stripeCurrency: currency as StripeChargeCurrency,
    exchangeRate: Number(data.exchangeRate) || 0,
    fxProvider: String(data.fxProvider || "locked"),
    fxTimestamp: String(data.fxTimestamp || ""),
    convertedAmount: Number(data.convertedAmount) || fromMinorUnits(minor),
    stripeSurchargePercent:
      Number(data.stripeSurchargePercent) || STRIPE_SURCHARGE_PERCENT,
    stripeSurchargeAmount: Number(data.stripeSurchargeAmount) || 0,
    finalStripeAmount: Number(data.finalStripeAmount) || fromMinorUnits(minor),
    stripeAmountMinor: minor,
  };
}

export function amountMajorFromSnapshot(snapshot: StripePriceSnapshot): number {
  return fromMinorUnits(toMinorUnits(snapshot.finalStripeAmount));
}
