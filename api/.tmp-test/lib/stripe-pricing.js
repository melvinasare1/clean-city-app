"use strict";
/**
 * Stripe presentation price: live FX, then Clean City 2% card payment surcharge.
 * Does not claim the 2% equals Stripe's fees.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_SURCHARGE_PERCENT = void 0;
exports.applyStripePaymentSurchargeMinor = applyStripePaymentSurchargeMinor;
exports.snapshotFromConversion = snapshotFromConversion;
exports.buildStripePriceSnapshot = buildStripePriceSnapshot;
exports.stripePriceSnapshotFields = stripePriceSnapshotFields;
exports.lockedSnapshotFromRecord = lockedSnapshotFromRecord;
exports.amountMajorFromSnapshot = amountMajorFromSnapshot;
const stripe_fx_1 = require("./stripe-fx");
exports.STRIPE_SURCHARGE_PERCENT = 2;
function applyStripePaymentSurchargeMinor(convertedMinor, percent = exports.STRIPE_SURCHARGE_PERCENT) {
    if (!Number.isFinite(convertedMinor) || convertedMinor <= 0) {
        throw new Error("Converted amount is invalid");
    }
    const finalMinor = Math.round((convertedMinor * (100 + percent)) / 100);
    return {
        surchargeMinor: finalMinor - convertedMinor,
        finalMinor,
    };
}
function snapshotFromConversion(conversion, percent = exports.STRIPE_SURCHARGE_PERCENT) {
    const { surchargeMinor, finalMinor } = applyStripePaymentSurchargeMinor(conversion.convertedAmountMinor, percent);
    return {
        sourceAmountGhs: conversion.sourceAmountGhs,
        sourceCurrency: "GHS",
        stripeCurrency: conversion.targetCurrency,
        exchangeRate: conversion.exchangeRate,
        fxProvider: conversion.provider,
        fxTimestamp: conversion.rateTimestamp,
        convertedAmount: conversion.convertedAmount,
        stripeSurchargePercent: percent,
        stripeSurchargeAmount: (0, stripe_fx_1.fromMinorUnits)(surchargeMinor),
        finalStripeAmount: (0, stripe_fx_1.fromMinorUnits)(finalMinor),
        stripeAmountMinor: finalMinor,
    };
}
async function buildStripePriceSnapshot(amountGhs, targetCurrency, options) {
    const conversion = await (0, stripe_fx_1.convertGhsToStripeCurrency)(amountGhs, targetCurrency, options);
    return snapshotFromConversion(conversion);
}
function stripePriceSnapshotFields(snapshot) {
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
function lockedSnapshotFromRecord(data, fallbackGhs) {
    if (!data)
        return null;
    const currency = String(data.stripeCurrency || "").toUpperCase();
    const minor = Number(data.stripeAmountMinor);
    if (!currency || !Number.isFinite(minor) || minor <= 0)
        return null;
    return {
        sourceAmountGhs: Number(data.sourceAmountGhs) || fallbackGhs,
        sourceCurrency: "GHS",
        stripeCurrency: currency,
        exchangeRate: Number(data.exchangeRate) || 0,
        fxProvider: String(data.fxProvider || "locked"),
        fxTimestamp: String(data.fxTimestamp || ""),
        convertedAmount: Number(data.convertedAmount) || (0, stripe_fx_1.fromMinorUnits)(minor),
        stripeSurchargePercent: Number(data.stripeSurchargePercent) || exports.STRIPE_SURCHARGE_PERCENT,
        stripeSurchargeAmount: Number(data.stripeSurchargeAmount) || 0,
        finalStripeAmount: Number(data.finalStripeAmount) || (0, stripe_fx_1.fromMinorUnits)(minor),
        stripeAmountMinor: minor,
    };
}
function amountMajorFromSnapshot(snapshot) {
    return (0, stripe_fx_1.fromMinorUnits)((0, stripe_fx_1.toMinorUnits)(snapshot.finalStripeAmount));
}
