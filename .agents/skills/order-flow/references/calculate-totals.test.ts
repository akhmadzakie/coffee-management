import { describe, it, expect } from "vitest";
import { calculateOrderTotals } from "./calculate-totals";

describe("calculateOrderTotals", () => {
  it("menghitung modifier dan jumlah", () => {
    const r = calculateOrderTotals({
      items: [{ unitPrice: 25000, quantity: 2, modifiers: [{ priceDelta: 5000 }] }],
    });
    expect(r.subtotal).toBe(60000);
    expect(r.total).toBe(60000);
  });

  it("diskon, service charge, lalu pajak", () => {
    const r = calculateOrderTotals({
      items: [{ unitPrice: 100000, quantity: 1 }],
      discount: 10000,
      serviceChargeBps: 500,
      taxBps: 1000,
    });
    expect(r.serviceCharge).toBe(4500);
    expect(r.tax).toBe(9450);
    expect(r.total).toBe(103950);
  });

  it("pembulatan ke Rp100", () => {
    const r = calculateOrderTotals({
      items: [{ unitPrice: 103950, quantity: 1 }],
      roundTo: 100,
    });
    expect(r.total).toBe(104000);
    expect(r.rounding).toBe(50);
  });

  it("diskon tidak membuat total negatif", () => {
    const r = calculateOrderTotals({
      items: [{ unitPrice: 10000, quantity: 1 }],
      discount: 99999,
    });
    expect(r.total).toBe(0);
  });
});
