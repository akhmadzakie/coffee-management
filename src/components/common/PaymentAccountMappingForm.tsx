import React from "react";
import { CashAccount, PaymentAccountChannel, PaymentAccountMapping } from "../../types";
import { CustomSelect } from "./CustomSelect";
import {
  PAYMENT_CHANNEL_DEFINITIONS,
  resolveEffectivePaymentAccountMapping,
} from "../../utils/paymentRouting";
import { Banknote, QrCode, CreditCard, ArrowLeftRight, Bike, Info } from "lucide-react";

interface PaymentAccountMappingFormProps {
  value?: PaymentAccountMapping | null;
  cashAccounts: CashAccount[];
  disabled?: boolean;
  onChange: (next: PaymentAccountMapping) => void;
  compact?: boolean;
}

const CHANNEL_ICONS: Record<PaymentAccountChannel, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-300" />,
  qris: <QrCode className="w-4 h-4 text-brand-600 dark:text-brand-300" />,
  edc: <CreditCard className="w-4 h-4 text-sky-600 dark:text-sky-300" />,
  transfer: <ArrowLeftRight className="w-4 h-4 text-brand-600 dark:text-brand-300" />,
  onlineDelivery: <Bike className="w-4 h-4 text-amber-600 dark:text-amber-300" />,
};

export const PaymentAccountMappingForm: React.FC<PaymentAccountMappingFormProps> = ({
  value,
  cashAccounts,
  disabled = false,
  onChange,
  compact = false,
}) => {
  const effective = resolveEffectivePaymentAccountMapping(value, cashAccounts);

  const accountOptions = cashAccounts.map((acc) => ({
    value: acc.id,
    label: acc.name,
    badge:
      acc.type === "CASH"
        ? "Tunai"
        : acc.type === "BANK"
        ? "Bank"
        : acc.type === "E_WALLET"
        ? "E-Wallet"
        : "Tabungan",
  }));

  return (
    <div className="space-y-3">
      <div
        className={`grid gap-3 ${
          compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 md:grid-cols-2"
        }`}
      >
        {PAYMENT_CHANNEL_DEFINITIONS.map((ch) => {
          const currentId = effective[ch.key] || "";
          return (
            <div
              key={ch.key}
              className="p-3 rounded-2xl bg-slate-50/90 dark:bg-slate-800/70 border border-slate-200/90 dark:border-slate-700/80 space-y-2"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-center shrink-0 shadow-2xs">
                  {CHANNEL_ICONS[ch.key]}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ch.label}
                  </p>
                  {!compact && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                      {ch.description}
                    </p>
                  )}
                </div>
              </div>
              <CustomSelect
                value={currentId}
                disabled={disabled || accountOptions.length === 0}
                onChange={(nextId) => {
                  onChange({
                    ...effective,
                    ...(value || {}),
                    [ch.key]: nextId,
                  });
                }}
                options={accountOptions}
                placeholder="Pilih Rekening / Pos Kas"
                buttonClassName="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-2xl bg-brand-50/70 dark:bg-brand-500/15 border border-brand-200/80 dark:border-brand-500/30 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5" />
        <p className="text-[11px] font-medium text-brand-900 dark:text-brand-200 leading-relaxed">
          Metode pembayaran yang diarahkan ke rekening yang <strong>sama</strong> otomatis digabung menjadi 1 mutasi bersih di Arus Kas. Jika diarahkan ke rekening <strong>berbeda</strong>, sistem otomatis memecah mutasi masuk ke masing-masing rekening tujuan.
        </p>
      </div>
    </div>
  );
};
