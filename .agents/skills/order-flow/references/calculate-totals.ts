import { applyBps } from "@/lib/money";

export type LineInput = {
  unitPrice: number;
  quantity: number;
  modifiers?: { priceDelta: number }[];
};

export type TotalsInput = {
  items: LineInput[];
  discount?: number; // potongan tetap (Rupiah)
  serviceChargeBps?: number;
  taxBps?: number;
  roundTo?: number; // 100 = bulatkan ke Rp100 terdekat; 0 = tanpa pembulatan
};

export type Totals = {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  rounding: number;
  total: number;
};

export function calculateLineTotal(line: LineInput): number {
  const modifierSum = (line.modifiers ?? []).reduce((s, m) => s + m.priceDelta, 0);
  return (line.unitPrice + modifierSum) * line.quantity;
}

export function calculateOrderTotals(input: TotalsInput): Totals {
  const subtotal = input.items.reduce((s, l) => s + calculateLineTotal(l), 0);
  const discount = Math.min(input.discount ?? 0, subtotal);
  const afterDiscount = subtotal - discount;

  const serviceCharge = applyBps(afterDiscount, input.serviceChargeBps ?? 0);
  const tax = applyBps(afterDiscount + serviceCharge, input.taxBps ?? 0);

  const raw = afterDiscount + serviceCharge + tax;
  const roundTo = input.roundTo ?? 0;
  const total = roundTo > 0 ? Math.round(raw / roundTo) * roundTo : raw;

  return { subtotal, discount, serviceCharge, tax, rounding: total - raw, total };
}
