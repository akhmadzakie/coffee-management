import {
  CashAccount,
  DailySalesRecap,
  PaymentAccountChannel,
  PaymentAccountMapping,
} from "../types";

export interface PaymentChannelDefinition {
  key: PaymentAccountChannel;
  label: string;
  shortLabel: string;
  description: string;
  recommendedType: "CASH" | "BANK_OR_EWALLET";
}

export const PAYMENT_CHANNEL_DEFINITIONS: PaymentChannelDefinition[] = [
  {
    key: "cash",
    label: "Tunai (Kasir / Laci)",
    shortLabel: "Tunai",
    description: "Uang tunai dari transaksi POS kasir & rekap penjualan tunai.",
    recommendedType: "CASH",
  },
  {
    key: "qris",
    label: "QRIS",
    shortLabel: "QRIS",
    description: "Penerimaan QRIS statis/dinamis (bisa masuk Bank atau E-Wallet).",
    recommendedType: "BANK_OR_EWALLET",
  },
  {
    key: "edc",
    label: "EDC / Debit / Kredit",
    shortLabel: "EDC",
    description: "Pembayaran kartu debit/kredit melalui mesin EDC bank.",
    recommendedType: "BANK_OR_EWALLET",
  },
  {
    key: "transfer",
    label: "Transfer Bank",
    shortLabel: "Transfer",
    description: "Transfer manual langsung ke rekening bank kafe.",
    recommendedType: "BANK_OR_EWALLET",
  },
  {
    key: "onlineDelivery",
    label: "Online / Ojol",
    shortLabel: "Ojol",
    description: "Pencairan GoFood, GrabFood, dan ShopeeFood.",
    recommendedType: "BANK_OR_EWALLET",
  },
];

const NON_CASH_CHANNELS: {
  channel: Exclude<PaymentAccountChannel, "cash">;
  amountKey: keyof Pick<
    DailySalesRecap,
    "qrisAmount" | "edcAmount" | "transferAmount" | "onlineDeliveryAmount"
  >;
  recapAccountKey: keyof Pick<
    DailySalesRecap,
    "qrisAccountId" | "edcAccountId" | "transferAccountId" | "onlineDeliveryAccountId"
  >;
  label: string;
}[] = [
  { channel: "qris", amountKey: "qrisAmount", recapAccountKey: "qrisAccountId", label: "QRIS" },
  { channel: "edc", amountKey: "edcAmount", recapAccountKey: "edcAccountId", label: "EDC" },
  { channel: "transfer", amountKey: "transferAmount", recapAccountKey: "transferAccountId", label: "Transfer" },
  {
    channel: "onlineDelivery",
    amountKey: "onlineDeliveryAmount",
    recapAccountKey: "onlineDeliveryAccountId",
    label: "Ojol",
  },
];

export function sanitizePaymentAccountMapping(raw: unknown): PaymentAccountMapping {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: PaymentAccountMapping = {};
  for (const def of PAYMENT_CHANNEL_DEFINITIONS) {
    const val = obj[def.key];
    if (typeof val === "string" && val.trim()) {
      out[def.key] = val.trim();
    }
  }
  return out;
}

export function resolveEffectivePaymentAccountMapping(
  mapping: PaymentAccountMapping | null | undefined,
  cashAccounts: CashAccount[]
): Record<PaymentAccountChannel, string> {
  const validIds = new Set(cashAccounts.map((a) => a.id));
  const fallbackCash =
    cashAccounts.find((a) => a.type === "CASH" && a.isDefault)?.id ||
    cashAccounts.find((a) => a.type === "CASH")?.id ||
    cashAccounts[0]?.id ||
    "";
  const fallbackNonCash =
    cashAccounts.find((a) => a.type === "BANK" && a.isDefault)?.id ||
    cashAccounts.find((a) => a.type === "BANK")?.id ||
    cashAccounts.find((a) => a.type === "E_WALLET")?.id ||
    cashAccounts[0]?.id ||
    "";

  const pick = (id: string | null | undefined, fallback: string) =>
    id && validIds.has(id) ? id : fallback;

  return {
    cash: pick(mapping?.cash, fallbackCash),
    qris: pick(mapping?.qris, fallbackNonCash),
    edc: pick(mapping?.edc, fallbackNonCash),
    transfer: pick(mapping?.transfer, fallbackNonCash),
    onlineDelivery: pick(mapping?.onlineDelivery, fallbackNonCash),
  };
}

export interface NonCashAccountGroup {
  accountId: string;
  amount: number;
  channels: Exclude<PaymentAccountChannel, "cash">[];
  descriptionParts: string[];
}

export interface RecapChannelAllocations {
  cashAccountId: string;
  cashAmount: number;
  nonCashGroups: NonCashAccountGroup[];
  mdrAccountId: string;
}

/**
 * Mengelompokkan aliran kas dari DailySalesRecap ke masing-masing rekening tujuan:
 * - Kanal non-tunai yang mengarah ke rekening SAMA digabung menjadi 1 mutasi bersih.
 * - Kanal non-tunai yang mengarah ke rekening BERBEDA dipecah otomatis per rekening.
 * - Tetap kompatibel penuh dengan rekap lama (`recap.bankAccountId` tanpa per-kanal override).
 */
export function resolveRecapChannelAllocations(params: {
  recap: DailySalesRecap;
  mapping?: PaymentAccountMapping | null;
  cashAccounts: CashAccount[];
  forceSingleBankAccountId?: string | null;
}): RecapChannelAllocations {
  const { recap, mapping, cashAccounts, forceSingleBankAccountId } = params;
  const validIds = new Set(cashAccounts.map((a) => a.id));
  const effective = resolveEffectivePaymentAccountMapping(mapping, cashAccounts);

  const cashAccountId =
    (recap.cashAccountId && validIds.has(recap.cashAccountId) ? recap.cashAccountId : "") ||
    effective.cash;
  const cashAmount = Math.max(0, Math.round(Number(recap.cashAmount) || 0));

  const groupMap = new Map<string, NonCashAccountGroup>();
  const legacyBankFallback =
    recap.bankAccountId && validIds.has(recap.bankAccountId) ? recap.bankAccountId : "";

  for (const ch of NON_CASH_CHANNELS) {
    const amt = Math.max(0, Math.round(Number(recap[ch.amountKey]) || 0));
    if (amt <= 0) continue;

    const perRecapOverride = recap[ch.recapAccountKey];
    const configuredDefault = mapping?.[ch.channel];

    let targetId = "";
    if (forceSingleBankAccountId && validIds.has(forceSingleBankAccountId)) {
      targetId = forceSingleBankAccountId;
    } else if (perRecapOverride && validIds.has(perRecapOverride)) {
      targetId = perRecapOverride;
    } else if (configuredDefault && validIds.has(configuredDefault)) {
      targetId = configuredDefault;
    } else if (legacyBankFallback) {
      targetId = legacyBankFallback;
    } else {
      targetId = effective[ch.channel];
    }

    if (!targetId) continue;

    const existing = groupMap.get(targetId);
    const partText = `${ch.label}: ${amt.toLocaleString("id-ID")}`;
    if (existing) {
      existing.amount += amt;
      existing.channels.push(ch.channel);
      existing.descriptionParts.push(partText);
    } else {
      groupMap.set(targetId, {
        accountId: targetId,
        amount: amt,
        channels: [ch.channel],
        descriptionParts: [partText],
      });
    }
  }

  const nonCashGroups = Array.from(groupMap.values());
  const largestGroup = [...nonCashGroups].sort((a, b) => b.amount - a.amount)[0];
  const mdrAccountId =
    (forceSingleBankAccountId && validIds.has(forceSingleBankAccountId)
      ? forceSingleBankAccountId
      : "") ||
    legacyBankFallback ||
    largestGroup?.accountId ||
    effective.qris;

  return {
    cashAccountId,
    cashAmount,
    nonCashGroups,
    mdrAccountId,
  };
}

export function getMappedChannelsForAccount(
  accountId: string,
  mapping?: PaymentAccountMapping | null
): string[] {
  if (!accountId || !mapping) return [];
  const labels: string[] = [];
  for (const def of PAYMENT_CHANNEL_DEFINITIONS) {
    if (mapping[def.key] === accountId) {
      labels.push(def.shortLabel);
    }
  }
  return labels;
}
