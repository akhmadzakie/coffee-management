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

  // Poll realtime tickets every 4 seconds
  useEffect(() => {
    fetchTickets();
    const interval = setInterval(fetchTickets, 4000);
    return () => clearInterval(interval);
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
    <div className="flex flex-col h-[calc(100vh-2rem)] w-full bg-slate-950 text-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-800 select-none">
      {/* ── Top Bar KDS ─────────────────────────────────────────────────── */}
      <div className="h-14 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              Kitchen & Bar Display System (KDS)
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {tickets.length} Antrean Aktif
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Stasiun: <strong className="text-orange-400">{stationFilter}</strong></span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {isOnline ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> Live Terhubung
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <WifiOff className="w-3 h-3" /> Offline / Terputus
                  </span>
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Station Filters & Controls */}
        <div className="flex items-center gap-2">
          {/* Station Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                    stationFilter === st.id
                      ? "bg-amber-500 text-slate-950 font-bold shadow"
                      : "text-slate-400 hover:text-white hover:bg-slate-900"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{st.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl border transition ${
              soundEnabled
                ? "bg-slate-800 text-amber-400 border-slate-700"
                : "bg-slate-900 text-slate-600 border-slate-800"
            }`}
            title={soundEnabled ? "Suara Chime Aktif" : "Suara Chime Bisu"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Refresh button */}
          <button
            onClick={fetchTickets}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700"
            title="Refresh Tiket"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {onNavigateBack ? (
            <button
              onClick={onNavigateBack}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition"
              title="Kembali ke Dashboard Manajemen"
            >
              Kembali ke Web
            </button>
          ) : (
            <button
              onClick={logout}
              title="Keluar dari akun barista/kitchen"
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Main KDS Cards Grid ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto p-4 bg-slate-950">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <RotateCcw className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-xs">Memuat antrean dapur & bar...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <CheckCircle2 className="w-12 h-12 stroke-1 text-emerald-500" />
            <h3 className="text-base font-bold text-white">Semua Pesanan Sudah Selesai!</h3>
            <p className="text-xs text-slate-500 text-center max-w-sm">
              Tidak ada antrean pesanan yang menunggu untuk dibuat di stasiun {stationFilter}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 items-start">
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
                  className={`rounded-2xl border flex flex-col justify-between overflow-hidden shadow-xl transition select-none ${
                    isUrgent
                      ? "bg-slate-900 border-rose-500/80 ring-1 ring-rose-500/50"
                      : isWarning
                      ? "bg-slate-900 border-amber-500/60"
                      : "bg-slate-900 border-slate-800"
                  }`}
                >
                  {/* Card Header: Table, Type, Order No, and Timer */}
                  <div
                    className={`p-3 border-b flex items-start justify-between ${
                      isUrgent
                        ? "bg-rose-500/10 border-rose-500/30"
                        : isWarning
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-slate-950/80 border-slate-800"
                    }`}
                  >
                    <div>
                      {/* Big Table / Takeaway display */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-black text-white">
                          {ticket.orderType === "DINE_IN"
                            ? ticket.tableNumber || "Meja -"
                            : "TAKE AWAY"}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                            ticket.orderType === "DINE_IN"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-sky-500/20 text-sky-300"
                          }`}
                        >
                          {ticket.orderType === "DINE_IN" ? "Dine In" : "Bungkus"}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        #{ticket.receiptNo} {ticket.customerName ? `• ${ticket.customerName}` : ""}
                      </p>
                    </div>

                    {/* Timer Badge */}
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-xl flex items-center gap-1 ${
                          isUrgent
                            ? "bg-rose-500 text-white animate-pulse"
                            : isWarning
                            ? "bg-amber-500 text-slate-950 font-black"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {minutes} mnt
                      </span>
                      {isUrgent && (
                        <p className="text-[9px] text-rose-400 font-bold mt-0.5">
                          TERLAMBAT
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Items List */}
                  <div className="p-3 space-y-2 flex-1">
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
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                            isItemReady
                              ? "bg-emerald-950/20 border-emerald-500/50 line-through text-slate-400"
                              : isItemPreparing
                              ? "bg-amber-950/20 border-amber-500/50 text-white"
                              : "bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-sm font-black text-amber-400 min-w-[20px]">
                                {item.quantity}x
                              </span>
                              <span className="text-xs font-bold leading-tight text-white">
                                {item.menuName}{" "}
                                {item.variantName ? `(${item.variantName})` : ""}
                              </span>
                            </div>

                            {/* Modifiers & Notes (Bold & Highlighted) */}
                            {item.notes && (
                              <p className="text-[11px] font-bold text-amber-300 mt-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block">
                                Catatan: {item.notes}
                              </p>
                            )}

                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.modifiers.map((m, mIdx) => (
                                  <span
                                    key={mIdx}
                                    className="text-[9px] font-bold bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded"
                                  >
                                    +{m.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Item status pill */}
                          <span
                            className={`text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider shrink-0 ${
                              isItemReady
                                ? "bg-emerald-500 text-slate-950"
                                : isItemPreparing
                                ? "bg-amber-500 text-slate-950 animate-pulse"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {item.itemStatus}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Card Bottom: Fast Action Buttons */}
                  <div className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                    {ticket.kitchenStatus !== "READY" ? (
                      <>
                        <button
                          onClick={() => handleUpdateOrderStatus(ticket.id, "PREPARING")}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                            isOrderPreparing
                              ? "bg-amber-500 text-slate-950"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                          }`}
                        >
                          Mulai Buat
                        </button>
                        <button
                          onClick={() => handleUpdateOrderStatus(ticket.id, "READY")}
                          className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-md shadow-emerald-500/20 transition flex items-center justify-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Siap Saji</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleUpdateOrderStatus(ticket.id, "SERVED")}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Selesai / Sudah Diantar (Selesaikan)</span>
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
