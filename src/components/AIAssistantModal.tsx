import React, { useState, useRef, useEffect } from "react";
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
  RotateCcw,
  Coffee,
  CheckCircle2,
  FileText,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useStore } from "../store/StoreContext";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTransactions?: (transactions: any[]) => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  time: string;
  source?: "gemini" | "local-expert";
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplyTransactions,
}) => {
  const { currentUser, settings, salesTransactions, ingredients } = useStore();
  const [activeTab, setActiveTab] = useState<"consultant" | "receipt" | "insights">("consultant");

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: `Halo ${currentUser?.name || "Rekan"}! Saya **Julia Coffee AI Copilot**.\n\nSaya siap membantu analisis HPP, optimasi alur barista, strategi promo jam sepi, maupun audit stok bahan baku. Apa yang ingin Anda diskusikan hari ini?`,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Receipt Scanner State
  const [receiptText, setReceiptText] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto scroll chat
  useEffect(() => {
    if (activeTab === "consultant") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  if (!isOpen) return null;

  // Preset Prompts for Quick Action
  const quickPrompts = [
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
      // Build lightweight store context
      const storeContext = {
        role: currentUser?.role,
        brand: settings.brandName,
        totalSalesCount: salesTransactions?.length || 0,
        ingredientCount: ingredients?.length || 0,
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
        text: `Terjadi kendala: ${err.message || "Gagal memproses"}. Pastikan server berjalan lancar.`,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setReceiptFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
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
        mimeType = receiptFile.type;
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
        body: JSON.stringify({ text: receiptText, imageBase64, mimeType }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses data nota");

      setScanResult(data);
    } catch (err: any) {
      setScanError(err.message || "Terjadi kesalahan saat memproses struk dengan AI");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-[#0D0F15] border border-white/[0.08] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] max-h-[820px] text-stone-100">
        
        {/* ─── MODAL TOPBAR ─── */}
        <div className="px-5 py-4 border-b border-white/[0.07] bg-[#12151D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white tracking-tight">Julia Coffee AI Copilot</h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  PRO
                </span>
              </div>
              <p className="text-xs text-stone-400">Konsultan Operasional & Analisis Cerdas Toko</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── NAVIGATION TABS ─── */}
        <div className="flex border-b border-white/[0.06] bg-[#0A0C11] px-3 gap-1">
          <button
            onClick={() => setActiveTab("consultant")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === "consultant"
                ? "border-amber-400 text-amber-300 bg-amber-500/[0.04]"
                : "border-transparent text-stone-400 hover:text-stone-200 hover:bg-white/[0.02]"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Konsultan Bisnis & Barista</span>
          </button>

          <button
            onClick={() => setActiveTab("receipt")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === "receipt"
                ? "border-amber-400 text-amber-300 bg-amber-500/[0.04]"
                : "border-transparent text-stone-400 hover:text-stone-200 hover:bg-white/[0.02]"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Scan Struk & Nota Belanja</span>
          </button>

          <button
            onClick={() => setActiveTab("insights")}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all ${
              activeTab === "insights"
                ? "border-amber-400 text-amber-300 bg-amber-500/[0.04]"
                : "border-transparent text-stone-400 hover:text-stone-200 hover:bg-white/[0.02]"
            }`}
          >
            <Lightbulb className="w-4 h-4" />
            <span>Rekomendasi Toko</span>
          </button>
        </div>

        {/* ─── TAB 1: KONSULTAN BISNIS & BARISTA ─── */}
        {activeTab === "consultant" && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0C11]">
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
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                        <Coffee className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`relative max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs sm:text-[13px] leading-relaxed group ${
                        isAi
                          ? "bg-[#141722] border border-white/[0.07] text-stone-200"
                          : "bg-amber-500 text-stone-950 font-medium"
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.text}</div>

                      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] opacity-60">
                        <span>{m.time}</span>
                        {isAi && (
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleCopy(m.id, m.text)}
                              className="hover:text-amber-400 flex items-center gap-1"
                              title="Salin jawaban"
                            >
                              {copiedId === m.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Tersalin</span>
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
                <div className="flex gap-3 items-center text-xs text-stone-400 py-1">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <span>Julia AI sedang menyusun rekomendasi...</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-4 py-2 border-t border-white/[0.04] bg-[#0E1118] flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[11px] text-stone-500 uppercase tracking-wider font-semibold shrink-0">
                Topik Cepat:
              </span>
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendChat(p.query)}
                  disabled={isAsking}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/30 border border-white/[0.06] text-[11px] text-stone-300 transition-colors disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <div className="p-3 sm:p-4 border-t border-white/[0.06] bg-[#12151D]">
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
                  className="flex-1 bg-[#090B10] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-400/50"
                />
                <button
                  type="submit"
                  disabled={!inputQuestion.trim() || isAsking}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:hover:bg-amber-500 shadow-md shadow-amber-500/10"
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

        {/* ─── TAB 2: SCAN STRUK & NOTA BELANJA ─── */}
        {activeTab === "receipt" && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#0A0C11]">
            <div className="rounded-xl p-4 bg-amber-500/[0.05] border border-amber-500/20 text-xs text-stone-300 leading-relaxed">
              <span className="font-semibold text-amber-300">Ekstraksi Pengeluaran Otomatis:</span>{" "}
              Unggah foto nota belanja bahan baku (susu, biji kopi, cup, es batu) atau ketik catatan belanja. AI akan mengonversinya menjadi draf transaksi kas secara presisi.
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1.5">
                  Catatan Naratif / Rincian Belanja
                </label>
                <textarea
                  value={receiptText}
                  onChange={(e) => setReceiptText(e.target.value)}
                  placeholder="Contoh: Beli es kristal 2 bal Rp 30.000 pake laci kasir, lalu beli susu segar Diamond 5 kotak total Rp 95.000..."
                  className="w-full bg-[#12151D] border border-white/[0.08] rounded-xl px-4 py-3 text-xs sm:text-sm text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-400/50 min-h-[90px] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-400 mb-1.5">
                  Foto Struk / Invoice (Opsional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />

                {!previewUrl ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-6 border border-dashed border-white/[0.12] rounded-xl text-stone-400 hover:text-stone-200 hover:border-amber-400/40 hover:bg-white/[0.02] transition-colors flex flex-col items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5 text-amber-400" />
                    <span className="text-xs font-medium">Klik untuk Pilih Foto Nota / Struk</span>
                    <span className="text-[10px] text-stone-500">Mendukung JPG, PNG, WebP</span>
                  </button>
                ) : (
                  <div className="relative rounded-xl border border-white/[0.08] p-2 bg-[#12151D]">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-44 object-contain rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setReceiptFile(null);
                        setPreviewUrl(null);
                      }}
                      className="absolute top-4 right-4 p-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-500/30 transition-colors"
                      title="Hapus foto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {scanError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{scanError}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleProcessReceipt}
                disabled={isScanning || (!receiptText && !receiptFile)}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menganalisis Struk dengan AI...</span>
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
                <div className="p-4 rounded-xl bg-[#141824] border border-white/[0.08] space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Draf Transaksi Terdeteksi ({scanResult.transactions.length})</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {scanResult.transactions.map((tx: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-[#0A0C11] p-3 rounded-lg border border-white/[0.05] flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-medium text-stone-200">{tx.description}</p>
                          <span className="text-[10px] text-stone-400 px-1.5 py-0.5 rounded bg-white/[0.05] mt-1 inline-block">
                            {tx.category || "Operasional"}
                          </span>
                        </div>
                        <div
                          className={`font-semibold font-mono text-sm ${
                            tx.type === "CASH_OUT" ? "text-rose-400" : "text-emerald-400"
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
                      className="w-full mt-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
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

        {/* ─── TAB 3: REKOMENDASI TOKO HARIAN ─── */}
        {activeTab === "insights" && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-[#0A0C11]">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Insight & Rekomendasi Prioritas Toko</span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              <div className="p-4 rounded-xl bg-[#12151E] border border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-300">1. Optimalisasi Menu Bertiket Tinggi</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Margin Tinggi
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Minuman kopi berbasis susu rasa (Caramel Macchiato, Salted Caramel Latte) memiliki margin kotor di atas 68%. Sarankan kasir melakukan penawaran upselling ukuran upsize atau add-on espresso shot.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#12151E] border border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300">2. Mitigasi Kebocoran Bahan (Waste Control)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    SOP Bar
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Gunakan milk pitcher bergaris skala 100ml / 150ml. Sisa susu yang di-steam ulang menurunkan cita rasa microfoam dan memicu pembuangan susu rata-rata 1.5 - 2 liter per hari.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#12151E] border border-white/[0.07] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-300">3. Strategi Jam Sepi (Slow Hours 14:00 - 17:00)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Omset Booster
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Pasang promo pairing "Kopi Filter / Americano + Croissant" seharga Rp 35.000 khusus pukul 14.00-17.00. Konversi pelanggan remote-working dapat menaikkan okupansi meja hingga 40%.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between text-xs text-stone-400 mt-4">
              <span>Ingin pembahasan mendalam mengenai toko Anda?</span>
              <button
                onClick={() => {
                  setActiveTab("consultant");
                  handleSendChat("Analisis cara meningkatkan margin rata-rata toko saya bulan ini.");
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition-colors font-medium"
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
