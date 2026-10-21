import React, { useState, useEffect, useRef } from "react";
import { useStore } from "../../store/StoreContext";
import { KitchenStatus, PrintDestination } from "../../types";
import {
  UtensilsCrossed,
  Coffee,
  Cake,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Sparkles,
  Maximize2,
  Minimize2,
  ArrowRight,
  Wifi,
  WifiOff,
  LogOut,
} from "lucide-react";

interface KdsTicket {
  id: string;
  receiptNo: string;
  orderType: "DINE_IN" | "TAKE_AWAY";
  tableNumber?: string | null;
  customerName?: string | null;
  status: string;
  kitchenStatus: KitchenStatus;
  createdAt: string;
  notes?: string | null;
  items: {
    id: string;
    orderId: string;
    menuName: string;
    variantName?: string | null;
    quantity: number;
    modifiers: { name: string; price: number }[];
    notes?: string | null;
    printDestination: PrintDestination;
    itemStatus: KitchenStatus;
  }[];
}

export const KitchenDisplaySystem: React.FC<{ onNavigateBack?: () => void }> = ({
  onNavigateBack,
}) => {
  const { currentUser, logout } = useStore();
  // Read initial station from URL query param ?station= (e.g. ?station=BAR, ?station=KITCHEN, ?station=BAKERY)
  const initialStation = (() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("station")?.toUpperCase();
      if (param && ["ALL", "BAR", "KITCHEN", "BAKERY"].includes(param)) {
        return param;
      }
    }
    return "ALL";
  })();

  const [stationFilter, setStationFilter] = useState<string>(initialStation);
  const [tickets, setTickets] = useState<KdsTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevTicketCountRef = useRef<number>(0);

  // Auto detect initial station based on user role or department if no URL param was set
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("station")?.toUpperCase();
    if (param && ["ALL", "BAR", "KITCHEN", "BAKERY"].includes(param)) {
      setStationFilter(param);
      return;
    }

    if (currentUser?.role === "BAR" || currentUser?.department === "BAR") {
      setStationFilter("BAR");
    } else if (currentUser?.role === "KITCHEN" || currentUser?.department === "KITCHEN") {
      setStationFilter("KITCHEN");
    } else if (currentUser?.role === "BAKER" || currentUser?.department === "BAKERY") {
      setStationFilter("BAKERY");
    }
  }, [currentUser]);

  // Handle station change and synchronize URL query param
  const handleSelectStation = (newStation: string) => {
    setStationFilter(newStation);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (newStation === "ALL") {
        url.searchParams.delete("station");
      } else {
        url.searchParams.set("station", newStation);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  // Web Audio Chime synthesizer for new incoming order
  const playChimeSound = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.45);
    } catch (e) {
      // Audio autoplay policy
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch(`/api/kds/tickets?station=${stationFilter}`);
      if (res.ok) {
        const data: KdsTicket[] = await res.json();
        // Cek jika ada tiket baru masuk (dibandingkan sebelumnya)
        if (prevTicketCountRef.current > 0 && data.length > prevTicketCountRef.current) {
          playChimeSound();
        }
        prevTicketCountRef.current = data.length;
        setTickets(data);
        setIsOnline(true);
      }
    } catch (e) {
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll realtime tickets every 8 seconds, only when tab is visible
  useEffect(() => {
    fetchTickets();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchTickets();
      }
    }, 8000);

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchTickets();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [stationFilter]);

  // Update item status
  const handleUpdateItemStatus = async (itemId: string, newStatus: KitchenStatus) => {
    try {
      const res = await fetch(`/api/kds/items/${itemId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (e) {
      alert("Gagal memperbarui status item");
    }
  };

  // Update entire order status
  const handleUpdateOrderStatus = async (orderId: string, newStatus: KitchenStatus) => {
    try {
      const res = await fetch(`/api/kds/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchTickets();
      }
    } catch (e) {
      alert("Gagal memperbarui status order");
    }
  };

  // Hitung durasi waktu tunggu (menit)
  const getElapsedMinutes = (createdAt: string) => {
    const elapsedMs = Date.now() - new Date(createdAt).getTime();
    return Math.floor(elapsedMs / (1000 * 60));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] w-full bg-slate-100 text-slate-900 rounded-2xl overflow-hidden shadow-xl border border-slate-200 select-none">
      {/* ── Top Bar KDS ─────────────────────────────────────────────────── */}
      <div className="h-16 px-5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 shadow-xs">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              Kitchen & Bar Display System (KDS)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold border border-brand-200">
                {tickets.length} Antrean Aktif
              </span>
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span>Stasiun: <strong className="text-brand-800 font-bold">{stationFilter}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1 font-medium">
                {isOnline ? (
                  <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Live Terhubung
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1 font-semibold">
                    <WifiOff className="w-3.5 h-3.5 text-rose-500" /> Offline / Terputus
                  </span>
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Station Filters & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Station Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            {[
              { id: "ALL", label: "Semua Stasiun", icon: Sparkles },
              { id: "BAR", label: "Bar Minuman", icon: Coffee },
              { id: "KITCHEN", label: "Kitchen Dapur", icon: UtensilsCrossed },
              { id: "BAKERY", label: "Baker / Pastry", icon: Cake },
            ].map((st) => {
              const IconComp = st.icon;
              return (
                <button
                  key={st.id}
                  onClick={() => handleSelectStation(st.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                    stationFilter === st.id
                      ? "bg-white text-slate-950 font-black shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 text-brand-600" />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition ${
              soundEnabled
                ? "bg-brand-50 text-brand-800 border-brand-200 shadow-2xs"
                : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
            }`}
            title={soundEnabled ? "Suara Chime Aktif" : "Suara Chime Bisu"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-brand-700" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchTickets}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-emerald-700 border border-slate-200 shadow-2xs transition"
            title="Refresh Tiket"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {onNavigateBack ? (
            <button
              onClick={onNavigateBack}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 border border-slate-200 shadow-2xs transition"
              title="Kembali ke Dashboard Manajemen"
            >
              Kembali ke Web
            </button>
          ) : (
            <button
              onClick={logout}
              title="Keluar dari akun barista/kitchen"
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main KDS Cards Grid ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 bg-slate-100/80">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
            <RotateCcw className="w-8 h-8 animate-spin text-brand-600" />
            <p className="text-xs font-medium text-slate-600">Memuat antrean dapur & bar...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-800">Semua Pesanan Sudah Siap!</h3>
            <p className="text-xs text-slate-500 text-center max-w-sm">
              Tidak ada antrean pesanan yang menunggu untuk dibuat di stasiun {stationFilter}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 items-start">
            {tickets.map((ticket) => {
              const minutes = getElapsedMinutes(ticket.createdAt);
              // Pewarnaan indikator waktu tunggu
              const isUrgent = minutes >= 10;
              const isWarning = minutes >= 5 && minutes < 10;

              const isOrderReady = ticket.kitchenStatus === "READY";
              const isOrderPreparing = ticket.kitchenStatus === "PREPARING";

              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl border flex flex-col justify-between overflow-hidden shadow-sm transition select-none bg-white ${
                    isUrgent
                      ? "border-rose-400 ring-2 ring-rose-400/30"
                      : isWarning
                      ? "border-amber-400 ring-2 ring-amber-400/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Card Header: Table, Type, Order No, and Timer */}
                  <div
                    className={`p-3.5 border-b flex items-start justify-between ${
                      isUrgent
                        ? "bg-rose-50/70 border-rose-200"
                        : isWarning
                        ? "bg-amber-50/70 border-amber-200"
                        : "bg-slate-50/80 border-slate-200"
                    }`}
                  >
                    <div>
                      {/* Big Table / Takeaway display */}
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900 tracking-tight">
                          {ticket.orderType === "DINE_IN"
                            ? ticket.tableNumber || "Meja -"
                            : "BUNGKUS / TAKEAWAY"}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-extrabold ${
                            ticket.orderType === "DINE_IN"
                              ? "bg-brand-50 text-brand-700 border border-brand-200"
                              : "bg-sky-100 text-sky-900 border border-sky-200"
                          }`}
                        >
                          {ticket.orderType === "DINE_IN" ? "Dine In" : "Takeaway"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-mono mt-0.5">
                        #{ticket.receiptNo} {ticket.customerName ? `• ${ticket.customerName}` : ""}
                      </p>
                    </div>

                    {/* Timer Badge */}
                    <div className="text-right">
                      <span
                        className={`text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-2xs ${
                          isUrgent
                            ? "bg-rose-600 text-white animate-pulse"
                            : isWarning
                            ? "bg-amber-500 text-slate-950"
                            : "bg-white text-slate-700 border border-slate-200"
                        }`}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {minutes} mnt
                      </span>
                      {isUrgent && (
                        <p className="text-[10px] text-rose-600 font-black mt-0.5 tracking-wider">
                          TERLAMBAT
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Items List */}
                  <div className="p-3.5 space-y-2 flex-1">
                    {ticket.items.map((item) => {
                      const isItemReady = item.itemStatus === "READY";
                      const isItemPreparing = item.itemStatus === "PREPARING";

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            // Cycle status: QUEUED -> PREPARING -> READY
                            const next =
                              item.itemStatus === "QUEUED"
                                ? "PREPARING"
                                : item.itemStatus === "PREPARING"
                                ? "READY"
                                : "SERVED";
                            handleUpdateItemStatus(item.id, next);
                          }}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2.5 ${
                            isItemReady
                              ? "bg-emerald-50/60 border-emerald-300 text-slate-400 line-through"
                              : isItemPreparing
                              ? "bg-amber-50/70 border-amber-300 text-slate-900 ring-1 ring-amber-300/40"
                              : "bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-100/60"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-base font-black text-brand-700 min-w-[24px]">
                                {item.quantity}x
                              </span>
                              <span className="text-sm font-bold leading-tight text-slate-900">
                                {item.menuName}{" "}
                                {item.variantName ? `(${item.variantName})` : ""}
                              </span>
                            </div>

                            {/* Modifiers & Notes (Bold & Highlighted) */}
                            {item.notes && (
                              <p className="text-xs font-bold text-brand-900 mt-1 bg-brand-50 px-2 py-0.5 rounded border border-brand-200 inline-block">
                                Catatan: {item.notes}
                              </p>
                            )}

                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.modifiers.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded"
                                  >
                                    +{m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Item status pill */}
                          <span
                            className={`text-[9px] font-extrabold px-2 py-1 rounded-lg uppercase tracking-wider shrink-0 ${
                              isItemReady
                                ? "bg-emerald-600 text-white"
                                : isItemPreparing
                                ? "bg-amber-500 text-slate-950 font-black animate-pulse"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {item.itemStatus}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card Bottom: Fast Action Buttons */}
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex gap-2">
                    {ticket.kitchenStatus !== "READY" ? (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(ticket.id, "PREPARING")}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border ${
                            isOrderPreparing
                              ? "bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs"
                              : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs"
                          }`}
                        >
                          Mulai Buat
                        </button>
                        <button
                          onClick={() => handleUpdateOrderStatus(ticket.id, "READY")}
                          className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Siap Saji</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleUpdateOrderStatus(ticket.id, "SERVED")}
                        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Selesai / Sudah Diantar (Tutup)</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
