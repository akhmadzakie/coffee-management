import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  X,
  Upload,
  Sparkles,
  Loader2,
  Send,
  MessageSquare,
  Receipt,
  Lightbulb,
  Copy,
  Check,
  TrendingUp,
  Coffee,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileSpreadsheet,
  File,
  Trash2,
  Zap,
  Plus,
  ArrowRight,
  Clock,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Package,
  Layers,
  Wallet,
} from "lucide-react";
import { useStore } from "../store/StoreContext";
import { formatCurrency } from "../utils/format";

export interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTransactions?: (
    transactions: any[],
    options?: { updateStock?: boolean }
  ) => void;
  initialTab?: "quick-input" | "receipt" | "consultant" | "insights";
  initialPrompt?: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  source?: "gemini" | "local-expert";
}

interface ParsedTransactionDraft {
  type: "CASH_OUT" | "CASH_IN";
  amount: number;
  category: string;
  description: string;
  accountId?: string;
  accountName?: string;
  ingredientId?: string | null;
  ingredientName?: string | null;
  quantity?: number | null;
  unit?: string | null;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplyTransactions,
  initialTab = "quick-input",
  initialPrompt = "",
}) => {
  const {
    currentUser,
    settings,
    salesTransactions,
    cashTransactions,
    ingredients,
    cashAccounts,
    expenseCategories,
  } = useStore();

  const [activeTab, setActiveTab] = useState<
    "quick-input" | "receipt" | "consultant" | "insights"
  >(initialTab);

  // Sync initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // AI Connection Status
  const [aiStatus, setAiStatus] = useState<{
    isConnected: boolean;
    model: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/ai/status")
        .then((res) => res.json())
        .then((data) => setAiStatus(data))
        .catch(() =>
          setAiStatus({
            isConnected: false,
            model: "offline",
            message: "Mode pintar lokal (offline)",
          })
        );
    }
  }, [isOpen]);

  // ─── TAB 1: QUICK NATURAL INPUT STATE ─────────────────────────────────────
  const [naturalText, setNaturalText] = useState("");
  const [isParsingNatural, setIsParsingNatural] = useState(false);
  const [naturalSummary, setNaturalSummary] = useState<string | null>(null);
  const [draftTransactions, setDraftTransactions] = useState<
    ParsedTransactionDraft[]
  >([]);
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);

  // Quick preset chips for rapid coffee shop entry
  const quickExpenseChips = [
    { label: "Susu UHT (6L)", text: "Beli susu Fresh Milk Greenfields 6 liter 111rb kas laci" },
    { label: "Es Kristal (2 Bal)", text: "Beli es batu kristal 2 bal 30rb kas laci" },
    { label: "Biji Kopi Espresso", text: "Beli biji kopi House Blend Espresso 2kg 360rb kas utama" },
    { label: "Air Galon RO", text: "Beli air galon RO 3 pcs 28.500 kas laci" },
    { label: "Cup & Kemasan", text: "Beli paper cup hot 8oz 2 dus 180rb transfer BCA" },
    { label: "Sabun & Plastik", text: "Beli sabun cuci piring sunlight dan plastik sampah 45rb kasir" },
  ];

  const handleParseNatural = async (textToParse?: string) => {
    const textInput = textToParse || naturalText;
    if (!textInput.trim() || isParsingNatural) return;

    setIsParsingNatural(true);
    setNaturalSummary(null);

    try {
      const storeContext = {
        cashAccounts: cashAccounts.map((a) => ({ id: a.id, name: a.name })),
        categories: expenseCategories.map((c: any) => ({ id: c.id, name: c.name })),
        ingredients: ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          currentStock: i.currentStock,
        })),
      };

      const res = await fetch("/api/ai/parse-natural-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textInput,
          storeContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses catatan");

      setNaturalSummary(data.summary || null);

      if (Array.isArray(data.transactions) && data.transactions.length > 0) {
        // Map suggested accounts to actual account IDs
        const defaultAcc = cashAccounts[0]?.id || "acc-main";
        const mapped = data.transactions.map((tx: any) => {
          let matchedAccId = defaultAcc;
          if (tx.accountName) {
            const foundAcc = cashAccounts.find(
              (a) =>
                a.name.toLowerCase().includes(tx.accountName.toLowerCase()) ||
                tx.accountName.toLowerCase().includes(a.name.toLowerCase())
            );
            if (foundAcc) matchedAccId = foundAcc.id;
          }

          // Match category if possible
          let matchedCat = tx.category || "Operasional";
          const foundCat = expenseCategories.find(
            (c: any) =>
              c.name.toLowerCase().includes(matchedCat.toLowerCase()) ||
              matchedCat.toLowerCase().includes(c.name.toLowerCase())
          );
          if (foundCat) matchedCat = foundCat.name;

          return {
            ...tx,
            accountId: matchedAccId,
            category: matchedCat,
          };
        });

        setDraftTransactions(mapped);
      }
    } catch (err: any) {
      alert("Kendala memproses input cerdas: " + (err.message || "Gagal"));
    } finally {
      setIsParsingNatural(false);
    }
  };

  const handleSaveDraftsToCashFlow = () => {
    if (draftTransactions.length === 0) return;
    if (onApplyTransactions) {
      onApplyTransactions(draftTransactions, { updateStock: autoUpdateStock });
      setDraftTransactions([]);
      setNaturalText("");
      setNaturalSummary(null);
      onClose();
    }
  };

  const updateDraftItem = (index: number, updates: Partial<ParsedTransactionDraft>) => {
    setDraftTransactions((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...updates } : item))
    );
  };

  const removeDraftItem = (index: number) => {
    setDraftTransactions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // ─── TAB 2: RECEIPT OCR STATE ─────────────────────────────────────────────
  const [receiptText, setReceiptText] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processSelectedFile = async (selectedFile: File) => {
    setReceiptFile(selectedFile);
    setScanError(null);

    const name = selectedFile.name.toLowerCase();
    const type = selectedFile.type.toLowerCase();

    if (type.startsWith("image/") || name.match(/\.(jpg|jpeg|png|webp|gif|heic|bmp|svg)$/)) {
      setPreviewUrl(URL.createObjectURL(selectedFile));
    } else {
      setPreviewUrl(null);
    }

    if (type.startsWith("text/") || name.endsWith(".csv") || name.endsWith(".txt")) {
      try {
        const textContent = await selectedFile.text();
        if (!receiptText.trim()) {
          setReceiptText(textContent.slice(0, 1500));
        }
      } catch {}
    }
  };

  const handleProcessReceipt = async () => {
    if (!receiptText && !receiptFile) return;

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      let imageBase64 = null;
      let mimeType = null;

      if (receiptFile) {
        mimeType =
          receiptFile.type ||
          (receiptFile.name.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : receiptFile.name.toLowerCase().endsWith(".csv")
            ? "text/csv"
            : "application/octet-stream");

        const reader = new FileReader();
        const readPromise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const res = reader.result as string;
            const b64 = res.split(",")[1];
            resolve(b64);
          };
        });
        reader.readAsDataURL(receiptFile);
        imageBase64 = await readPromise;
      }

      const response = await fetch("/api/ai/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: receiptText,
          imageBase64,
          mimeType,
          fileName: receiptFile?.name,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses data nota");

      setScanResult(data);
    } catch (err: any) {
      setScanError(err.message || "Terjadi kesalahan saat memproses berkas dengan AI");
    } finally {
      setIsScanning(false);
    }
  };

  // ─── TAB 3: CHAT CONSULTANT STATE ─────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: `Halo ${currentUser?.name || "Rekan"}! Saya **Julia Coffee AI Copilot**.\n\nSaya siap membantu analisis HPP, optimasi alur barista saat rush hour, strategi promo jam sepi, maupun audit stok bahan baku toko. Apa yang ingin Anda diskusikan hari ini?`,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState(initialPrompt || "");
  const [isAsking, setIsAsking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto scroll chat
  useEffect(() => {
    if (activeTab === "consultant") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  // When initialPrompt is passed, load it
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim()) {
      setInputQuestion(initialPrompt);
    }
  }, [initialPrompt]);

  const quickConsultantPrompts = [
    { label: "Hitung HPP Kopi Susu", query: "Bagaimana cara hitung rincian HPP dan margin optimal kopi susu gula aren 12oz?" },
    { label: "Optimalisasi Rush Hour", query: "Bagaimana pembagian tugas dan workflow 2 barista saat rush hour ramai?" },
    { label: "Promo Jam Sepi (14-17)", query: "Berikan 3 ide promo menarik untuk menaikkan omset di jam sepi 14.00-17.00." },
    { label: "Cegah Waste Susu & Kopi", query: "Bagaimana SOP mencegah susu basi dan meminimalkan waste biji kopi di bar?" },
  ];

  const handleSendChat = async (questionText?: string) => {
    const textToSend = questionText || inputQuestion;
    if (!textToSend.trim() || isAsking) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: "user",
      text: textToSend.trim(),
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInputQuestion("");
    setIsAsking(true);

    try {
      const storeContext = {
        role: currentUser?.role,
        brand: settings.brandName,
        totalSalesCount: salesTransactions?.length || 0,
        ingredientCount: ingredients?.length || 0,
        lowStockItems: ingredients.filter((i) => i.currentStock <= i.minStock).map((i) => i.name),
      };

      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        text: m.text,
      }));

      const res = await fetch("/api/ai/ask-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          chatHistory: historyPayload,
          storeContext,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghubungi AI");

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: data.reply || "Maaf, tidak dapat menghasilkan jawaban.",
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        source: data.source,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: `Terjadi kendala: ${err.message || "Gagal memproses"}. Sistem tetap dapat berkonsultasi dalam mode offline.`,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── TAB 4: MANAGEMENT INSIGHTS & AUDIT STATE ─────────────────────────────
  const [executiveBriefing, setExecutiveBriefing] = useState<string | null>(null);
  const [isLoadingBriefing, setIsLoadingBriefing] = useState(false);

  // Computed Live Store Metrics
  const liveMetrics = useMemo(() => {
    const totalRev = salesTransactions.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const totalExp = cashTransactions
      .filter((c) => c.type === "OUT")
      .reduce((acc, c) => acc + (c.amount || 0), 0);
    const netProfit = Math.max(0, totalRev - totalExp);
    const marginPercent = totalRev > 0 ? Math.round((netProfit / totalRev) * 100) : 0;

    const lowStock = ingredients.filter((i) => i.currentStock <= i.minStock);

    // Star Products
    const itemMap = new Map<string, { name: string; qty: number; rev: number }>();
    salesTransactions.forEach((s) => {
      s.items?.forEach((item) => {
        const cur = itemMap.get(item.name) || { name: item.name, qty: 0, rev: 0 };
        cur.qty += item.quantity || 1;
        cur.rev += (item.quantity || 1) * (item.price || 0);
        itemMap.set(item.name, cur);
      });
    });
    const topStarProducts = Array.from(itemMap.values())
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 4);

    return {
      totalRevenue: totalRev,
      totalExpense: totalExp,
      netProfit,
      marginPercent,
      lowStockItems: lowStock,
      topStarProducts,
    };
  }, [salesTransactions, cashTransactions, ingredients]);

  const handleGenerateExecutiveBriefing = async () => {
    setIsLoadingBriefing(true);
    try {
      const payloadMetrics = {
        totalRevenue: liveMetrics.totalRevenue,
        totalExpense: liveMetrics.totalExpense,
        netProfit: liveMetrics.netProfit,
        marginPercent: liveMetrics.marginPercent,
        lowStockItems: liveMetrics.lowStockItems.map((i) => ({
          name: i.name,
          currentStock: i.currentStock,
          minStock: i.minStock,
          unit: i.unit,
        })),
        topProducts: liveMetrics.topStarProducts,
      };

      const res = await fetch("/api/ai/executive-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: payloadMetrics }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghasilkan briefing eksekutif");

      setExecutiveBriefing(data.briefing || "Tidak ada ringkasan.");
    } catch (err: any) {
      alert("Kendala briefing eksekutif: " + (err.message || "Gagal"));
    } finally {
      setIsLoadingBriefing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-2.5 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[850px] text-slate-900">
        
        {/* ─── MODAL HEADER ─── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-[#FAFAFA] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200/70 flex items-center justify-center text-brand-600 shadow-2xs">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Julia Coffee AI Copilot
                </h3>
                {aiStatus?.isConnected ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Gemini 2.5 Flash Aktif
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-mono flex items-center gap-1.5 shadow-2xs"
                    title="Kunci API Gemini belum dipasang di Pengaturan. Berjalan dalam mode cerdas lokal internal."
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    Mode Cerdas Lokal
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Data Entry Cerdas, Analisis Manajemen & Konsultan Specialty Coffee
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── NAVIGATION TABS ─── */}
        <div className="flex border-b border-slate-200 bg-[#F8F9FA] px-3 sm:px-4 gap-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("quick-input")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "quick-input"
                ? "border-brand-600 text-brand-900 bg-white shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
            }`}
          >
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500/20" />
            <span>Catat Cepat (Input Pintar)</span>
          </button>

          <button
            onClick={() => setActiveTab("receipt")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "receipt"
                ? "border-brand-600 text-brand-900 bg-white shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
            }`}
          >
            <Receipt className="w-4 h-4 text-brand-600" />
            <span>Pindai Nota / OCR</span>
          </button>

          <button
            onClick={() => setActiveTab("consultant")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "consultant"
                ? "border-brand-600 text-brand-900 bg-white shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
            }`}
          >
            <MessageSquare className="w-4 h-4 text-brand-600" />
            <span>Konsultan Bisnis & Barista</span>
          </button>

          <button
            onClick={() => setActiveTab("insights")}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "insights"
                ? "border-brand-600 text-brand-900 bg-white shadow-2xs"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-brand-600" />
            <span>Audit & Rekomendasi Toko</span>
          </button>
        </div>

        {/* ─── TAB 1: CATAT CEPAT (INPUT PINTAR BAHASA ALAMI) ─── */}
        {activeTab === "quick-input" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F8F9FA]">
            {/* Header Banner */}
            <div className="rounded-2xl p-4 bg-gradient-to-r from-brand-50 to-indigo-50/50 border border-brand-200/80 text-xs text-brand-950 leading-relaxed shadow-2xs flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-brand-200 flex items-center justify-center shrink-0 text-brand-600 mt-0.5 shadow-2xs">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-xs sm:text-[13px]">
                  Catat Pengeluaran & Pemasukan Tanpa Ribet
                </p>
                <p className="text-slate-600 text-[11px] sm:text-xs mt-0.5">
                  Cukup ketik atau salin catatan belanja kasir dalam kalimat sehari-hari (contoh:{" "}
                  <span className="font-medium text-brand-700">
                    "Beli susu Greenfields 6 liter 111rb kas laci, es kristal 2 bal 30rb"
                  </span>
                  ). AI akan membedah nominal, pos kas, kategori biaya, dan menghubungkannya dengan stok bahan baku.
                </p>
              </div>
            </div>

            {/* Input Form */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <label className="block text-xs font-bold text-slate-700">
                Tulis / Tempel Catatan Belanja Harian:
              </label>
              <textarea
                value={naturalText}
                onChange={(e) => setNaturalText(e.target.value)}
                placeholder="Contoh: Beli susu Diamond 6 liter 114.000 kas laci, beli es kristal 2 bal 30rb, air galon 2 pcs 19rb..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-600 focus:bg-white resize-none transition-all"
              />

              {/* Quick Template Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                  Pilihan Cepat:
                </span>
                {quickExpenseChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNaturalText((prev) => (prev ? `${prev}, ${chip.text}` : chip.text));
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-800 border border-slate-200/80 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    + {chip.label}
                  </button>
                ))}
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-500">
                  {draftTransactions.length > 0
                    ? `Ditemukan ${draftTransactions.length} transaksi siap disimpan.`
                    : "Tekan tombol untuk membedah data secara otomatis."}
                </span>

                <button
                  type="button"
                  onClick={() => handleParseNatural()}
                  disabled={!naturalText.trim() || isParsingNatural}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 shadow-xs cursor-pointer"
                >
                  {isParsingNatural ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Membedah Catatan...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ekstrak Transaksi Otomatis</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Result Area */}
            {naturalSummary && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{naturalSummary}</span>
              </div>
            )}

            {draftTransactions.length > 0 && (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Draf Transaksi Terstruktur ({draftTransactions.length})</span>
                  </h4>

                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    <input
                      type="checkbox"
                      checked={autoUpdateStock}
                      onChange={(e) => setAutoUpdateStock(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500 w-3.5 h-3.5"
                    />
                    <span>Perbarui stok masuk di Gudang/Bar secara otomatis</span>
                  </label>
                </div>

                <div className="space-y-2.5">
                  {draftTransactions.map((tx, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                              tx.type === "CASH_OUT"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {tx.type === "CASH_OUT" ? "KAS KELUAR" : "KAS MASUK"}
                          </span>

                          <input
                            type="text"
                            value={tx.description}
                            onChange={(e) =>
                              updateDraftItem(idx, { description: e.target.value })
                            }
                            className="font-bold text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-brand-600 focus:outline-none px-1 py-0.5 rounded flex-1 min-w-[180px]"
                          />
                        </div>

                        {/* Modifiers & Account Selectors */}
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          {/* Account Picker */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                            <Wallet className="w-3 h-3 text-slate-400" />
                            <select
                              value={tx.accountId || cashAccounts[0]?.id}
                              onChange={(e) =>
                                updateDraftItem(idx, { accountId: e.target.value })
                              }
                              className="bg-transparent border-none text-[11px] font-semibold text-slate-800 focus:outline-none cursor-pointer"
                            >
                              {cashAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Category Picker */}
                          <div className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                            <Layers className="w-3 h-3 text-slate-400" />
                            <select
                              value={tx.category}
                              onChange={(e) =>
                                updateDraftItem(idx, { category: e.target.value })
                              }
                              className="bg-transparent border-none text-[11px] font-semibold text-slate-800 focus:outline-none cursor-pointer"
                            >
                              {expenseCategories.map((c: any) => (
                                <option key={c.id} value={c.name}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Ingredient Matched Badge */}
                          {tx.ingredientName && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Package className="w-3 h-3 text-indigo-500" />
                              <span>
                                Bahan: {tx.ingredientName} (+{tx.quantity || 1} {tx.unit || "unit"})
                              </span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-medium">
                            Nominal (Rp)
                          </span>
                          <input
                            type="number"
                            value={tx.amount}
                            onChange={(e) =>
                              updateDraftItem(idx, { amount: Number(e.target.value) })
                            }
                            className={`font-bold font-mono text-sm sm:text-base text-right w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-brand-600 ${
                              tx.type === "CASH_OUT" ? "text-rose-600" : "text-emerald-600"
                            }`}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeDraftItem(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus baris ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submit All to Cash Flow */}
                <button
                  type="button"
                  onClick={handleSaveDraftsToCashFlow}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    Simpan Seluruh Transaksi ({draftTransactions.length}) ke Buku Kas Toko
                  </span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: EKSTRAKSI BERKAS & STRUK (OCR) ─── */}
        {activeTab === "receipt" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F8F9FA]">
            <div className="rounded-2xl p-4 bg-brand-50/80 border border-brand-200/80 text-xs text-brand-950 leading-relaxed shadow-2xs">
              <span className="font-bold text-brand-950">Ekstraksi Dokumen & Nota Multi-Format:</span>{" "}
              Unggah berkas bukti belanja atau ketik catatan belanja. AI Copilot mendukung foto struk kamera (JPG/PNG/WebP), dokumen PDF invoice supplier, spreadsheet Excel / CSV, hingga catatan teks dokumen. Transaksi kas akan otomatis dirangkum secara rapi.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Catatan Naratif / Rincian Belanja (Opsional)
                </label>
                <textarea
                  value={receiptText}
                  onChange={(e) => setReceiptText(e.target.value)}
                  placeholder="Contoh: Beli es kristal 2 bal Rp 30.000 pake laci kasir, lalu beli susu segar Diamond 5 kotak total Rp 95.000..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-600 min-h-[85px] resize-none shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Berkas Dokumen / Foto Struk / Invoice</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Mendukung Foto, PDF, Excel/CSV & Dokumen
                  </span>
                </label>

                <input
                  type="file"
                  accept="image/*,application/pdf,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/plain,text/csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processSelectedFile(f);
                  }}
                />

                {!receiptFile ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) processSelectedFile(f);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full py-6 px-4 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 text-center ${
                      isDragging
                        ? "border-brand-600 bg-brand-50/70 ring-4 ring-brand-500/10"
                        : "border-slate-200 bg-slate-50/70 hover:bg-white hover:border-brand-400"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shadow-2xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-stone-800 block">
                        Klik untuk Pilih Berkas atau Tarik ke Sini
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">
                        Mendukung Foto Struk, PDF Invoice, Excel/CSV, dan Catatan Dokumen
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        📷 Foto (JPG/PNG/WebP)
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                        📄 Dokumen PDF Faktur
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        📊 Excel & CSV
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                        📝 Dokumen / Teks
                      </span>
                    </div>
                  </div>
                ) : previewUrl ? (
                  /* ── Image Preview ── */
                  <div className="relative rounded-2xl border border-slate-200 p-2.5 bg-white shadow-2xs">
                    <img
                      src={previewUrl}
                      alt="Preview Struk"
                      className="w-full h-44 object-contain rounded-xl bg-slate-50"
                    />
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs px-1">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200 font-mono">
                          FOTO
                        </span>
                        <span className="text-slate-700 font-medium truncate max-w-[220px]">
                          {receiptFile.name}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          ({formatFileSize(receiptFile.size)})
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-slate-600 hover:text-brand-700 hover:bg-slate-100 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border border-slate-200"
                        >
                          Ganti
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptFile(null);
                            setPreviewUrl(null);
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-rose-100"
                          title="Hapus foto"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Non-Image Document Preview (PDF, Excel, CSV, Doc, Text) ── */
                  <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-2xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                          receiptFile.name.toLowerCase().endsWith(".pdf")
                            ? "bg-rose-50 border-rose-200 text-rose-600"
                            : receiptFile.name.toLowerCase().match(/\.(csv|xlsx|xls)$/)
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                            : "bg-brand-50 border-brand-200 text-brand-700"
                        }`}
                      >
                        {receiptFile.name.toLowerCase().endsWith(".pdf") ? (
                          <FileText className="w-6 h-6" />
                        ) : receiptFile.name.toLowerCase().match(/\.(csv|xlsx|xls)$/) ? (
                          <FileSpreadsheet className="w-6 h-6" />
                        ) : (
                          <File className="w-6 h-6" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {receiptFile.name}
                          </p>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono shrink-0 ${
                              receiptFile.name.toLowerCase().endsWith(".pdf")
                                ? "bg-rose-100 text-rose-800 border-rose-200"
                                : receiptFile.name.toLowerCase().match(/\.(csv|xlsx|xls)$/)
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-sky-100 text-sky-800 border-sky-200"
                            }`}
                          >
                            {receiptFile.name.split(".").pop()?.toUpperCase() || "DOC"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {formatFileSize(receiptFile.size)} • Dokumen siap dipindai oleh AI
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                      >
                        Ganti
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptFile(null);
                          setPreviewUrl(null);
                        }}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-rose-100"
                        title="Hapus berkas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {scanError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleProcessReceipt}
                disabled={isScanning || (!receiptText && !receiptFile)}
                className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-xs cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menganalisis Berkas dengan AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Ekstrak & Susun Transaksi Sekarang</span>
                  </>
                )}
              </button>

              {/* Draft Results */}
              {scanResult && scanResult.transactions && (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Draf Transaksi Terdeteksi ({scanResult.transactions.length})</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {scanResult.transactions.map((tx: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-slate-800">{tx.description}</p>
                          <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-md bg-white border border-slate-200 mt-1 inline-block font-medium">
                            {tx.category || "Operasional"}
                          </span>
                        </div>
                        <div
                          className={`font-bold font-mono text-sm ${
                            tx.type === "CASH_OUT" ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {tx.type === "CASH_OUT" ? "-" : "+"} Rp{" "}
                          {Number(tx.amount || 0).toLocaleString("id-ID")}
                        </div>
                      </div>
                    ))}
                  </div>

                  {onApplyTransactions && (
                    <button
                      onClick={() => {
                        onApplyTransactions(scanResult.transactions);
                        onClose();
                      }}
                      className="w-full mt-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Terapkan Semua ke Buku Kas Toko</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 3: KONSULTAN BISNIS & BARISTA (CHAT) ─── */}
        {activeTab === "consultant" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#F8F9FA]">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.map((m) => {
                const isAi = m.sender === "ai";
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3 ${isAi ? "justify-start" : "justify-end"}`}
                  >
                    {isAi && (
                      <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200/80 text-brand-600 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                        <Coffee className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`relative max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-[13px] leading-relaxed group shadow-2xs ${
                        isAi
                          ? "bg-white border border-slate-200/90 text-slate-800"
                          : "bg-brand-600 text-white font-medium"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.text}</div>

                      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] opacity-70">
                        <span>{m.time}</span>
                        {isAi && (
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopy(m.id, m.text)}
                              className="hover:text-brand-600 flex items-center gap-1 font-medium cursor-pointer"
                              title="Salin jawaban"
                            >
                              {copiedId === m.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span className="text-emerald-600">Tersalin</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Salin</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isAsking && (
                <div className="flex gap-3 items-center text-xs text-slate-500 py-1">
                  <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200/80 text-brand-600 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <span>Julia AI sedang menyusun rekomendasi...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-4 py-2.5 border-t border-slate-200/80 bg-white flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider font-bold shrink-0">
                Topik Cepat:
              </span>
              {quickConsultantPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChat(p.query)}
                  disabled={isAsking}
                  className="shrink-0 px-3 py-1 rounded-lg bg-slate-50 hover:bg-brand-50 hover:text-brand-800 hover:border-brand-300 border border-slate-200 text-xs text-slate-700 font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputQuestion}
                  onChange={(e) => setInputQuestion(e.target.value)}
                  placeholder="Ketik pertanyaan bisnis, HPP, resep, atau SOP barista..."
                  disabled={isAsking}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-600 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!inputQuestion.trim() || isAsking}
                  className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all disabled:opacity-40 shadow-xs cursor-pointer"
                >
                  {isAsking ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Kirim</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── TAB 4: AUDIT & REKOMENDASI TOKO (EXECUTIVE MANAGEMENT) ─── */}
        {activeTab === "insights" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#F8F9FA]">
            {/* Live KPI Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Margin Laba Toko
                </span>
                <p className="text-xl font-bold font-mono text-emerald-600">
                  {liveMetrics.marginPercent}%
                </p>
                <span className="text-[11px] text-slate-500 block">
                  Net: Rp {liveMetrics.netProfit.toLocaleString("id-ID")}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Bahan Baku Kritis
                </span>
                <p
                  className={`text-xl font-bold font-mono ${
                    liveMetrics.lowStockItems.length > 0 ? "text-rose-600" : "text-slate-800"
                  }`}
                >
                  {liveMetrics.lowStockItems.length} Bahan
                </p>
                <span className="text-[11px] text-slate-500 block">
                  Di bawah batas minimum
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Omzet Toko
                </span>
                <p className="text-xl font-bold font-mono text-slate-900">
                  Rp {liveMetrics.totalRevenue.toLocaleString("id-ID")}
                </p>
                <span className="text-[11px] text-slate-500 block">
                  Biaya: Rp {liveMetrics.totalExpense.toLocaleString("id-ID")}
                </span>
              </div>
            </div>

            {/* Low Stock Alert List */}
            {liveMetrics.lowStockItems.length > 0 && (
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span className="text-xs font-bold text-rose-950">
                      Peringatan Stok Menipis (Segera Belanja)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                    Prioritas Restock
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {liveMetrics.lowStockItems.slice(0, 4).map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-2.5 rounded-xl border border-rose-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <span className="text-[10px] text-rose-600 font-semibold">
                          Sisa: {item.currentStock} {item.unit} (Min: {item.minStock} {item.unit})
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setActiveTab("quick-input");
                          setNaturalText(
                            `Beli ${item.name} ${item.minStock} ${item.unit} kas laci`
                          );
                        }}
                        className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold transition-colors cursor-pointer"
                      >
                        + Catat Belanja
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Executive AI Generator Section */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-600" />
                    <span>Laporan Analisis Eksekutif AI Hari Ini</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluasi komprehensif profit margin, strategi menu lambat, dan optimasi barista.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateExecutiveBriefing}
                  disabled={isLoadingBriefing}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {isLoadingBriefing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyusun Laporan...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                      <span>Generate Ringkasan Eksekutif AI</span>
                    </>
                  )}
                </button>
              </div>

              {executiveBriefing ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-[13px] leading-relaxed text-slate-800 whitespace-pre-wrap animate-in fade-in">
                  {executiveBriefing}
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                  <Lightbulb className="w-6 h-6 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Laporan Eksekutif Belum Dibuat
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    Klik tombol di atas untuk memerintahkan AI membaca kondisi real-time toko Anda dan merumuskan saran operasional terbaik.
                  </p>
                </div>
              )}
            </div>

            {/* Quick Action Footer */}
            <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-200/80 flex items-center justify-between text-xs text-slate-700">
              <span className="font-medium">Ingin konsultasi langsung langkah aksi dengan AI?</span>
              <button
                onClick={() => {
                  setActiveTab("consultant");
                  handleSendChat("Analisis cara meningkatkan margin rata-rata toko saya bulan ini.");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors font-bold shadow-2xs cursor-pointer"
              >
                Tanya Konsultan AI →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
