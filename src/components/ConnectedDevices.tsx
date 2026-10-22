import React, { useState, useEffect } from "react";
import { useStore } from "../store/StoreContext";
import {
  Laptop,
  Smartphone,
  Tablet,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  RefreshCw,
  Clock,
  Globe,
  User as UserIcon,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { DeviceSession } from "../types";

export const ConnectedDevices: React.FC = () => {
  const {
    sessions,
    currentSessionId,
    fetchSessions,
    revokeSession,
    revokeOtherSessions,
    currentUser,
    settings,
  } = useStore();

  const [isLoading, setIsLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [confirmSessionId, setConfirmSessionId] = useState<string | null>(null);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isIndo = settings.language === "id";

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchSessions();
    setTimeout(() => setIsLoading(false), 400);
  };

  const handleRevoke = async (sessionId: string) => {
    setProcessingId(sessionId);
    const success = await revokeSession(sessionId);
    setProcessingId(null);
    setConfirmSessionId(null);

    if (success) {
      setActionMessage({
        type: "success",
        text: isIndo
          ? "Sesi perangkat berhasil diputus."
          : "Device session was successfully terminated.",
      });
    } else {
      setActionMessage({
        type: "error",
        text: isIndo
          ? "Gagal memutuskan sesi perangkat."
          : "Failed to terminate device session.",
      });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const handleRevokeOthers = async () => {
    setProcessingId("others");
    const success = await revokeOtherSessions();
    setProcessingId(null);
    setConfirmRevokeOthers(false);

    if (success) {
      setActionMessage({
        type: "success",
        text: isIndo
          ? "Semua perangkat lain telah berhasil dikeluarkan."
          : "All other device sessions have been revoked.",
      });
    } else {
      setActionMessage({
        type: "error",
        text: isIndo
          ? "Gagal memutuskan sesi perangkat lain."
          : "Failed to revoke other sessions.",
      });
    }
    setTimeout(() => setActionMessage(null), 4000);
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const now = new Date().getTime();
      const time = new Date(isoString).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 15) return isIndo ? "Baru saja" : "Just now";
      if (diffSec < 60)
        return `${diffSec} ${isIndo ? "detik lalu" : "sec ago"}`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60)
        return `${diffMin} ${isIndo ? "menit lalu" : "min ago"}`;
      const diffHour = Math.floor(diffMin / 60);
      if (diffHour < 24)
        return `${diffHour} ${isIndo ? "jam lalu" : "hrs ago"}`;
      const diffDays = Math.floor(diffHour / 24);
      return `${diffDays} ${isIndo ? "hari lalu" : "days ago"}`;
    } catch {
      return isoString;
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(isIndo ? "id-ID" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  const getDeviceIcon = (deviceType: string, className = "w-5 h-5") => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className={className} />;
      case "tablet":
        return <Tablet className={className} />;
      default:
        return <Laptop className={className} />;
    }
  };

  const currentSession = sessions.find(
    (s) => s.isCurrent || s.id === currentSessionId,
  );
  const otherSessions = sessions.filter(
    (s) => !s.isCurrent && s.id !== currentSessionId,
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              {isIndo ? "Perangkat Terhubung" : "Connected Devices"}
            </h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              {sessions.length} {isIndo ? "Aktif" : "Active"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isIndo
              ? "Kelola sesi login aktif dan pantau keamanan akun Anda di berbagai perangkat."
              : "Manage active login sessions and oversee account security across different devices."}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title={isIndo ? "Segarkan daftar sesi" : "Refresh session list"}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${isLoading ? "animate-spin text-blue-600" : ""}`}
            />
            <span>{isIndo ? "Segarkan" : "Refresh"}</span>
          </button>

          {otherSessions.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmRevokeOthers(true)}
              className="whitespace-nowrap shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isIndo
                  ? "Keluarkan Semua Perangkat Lain"
                  : "Revoke All Other Devices"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Action status message */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
            actionMessage.type === "success"
              ? "bg-blue-50 text-blue-700 border border-blue-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {actionMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Confirm Revoke Others Modal / Banner */}
      {confirmRevokeOthers && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-900">
                {isIndo
                  ? "Putus Sesi Semua Perangkat Lain?"
                  : "Force Logout All Other Devices?"}
              </h4>
              <p className="text-xs text-rose-700 mt-1">
                {isIndo
                  ? `Tindakan ini akan langsung mengeluarkan ${otherSessions.length} sesi di perangkat lain. Pengguna harus login kembali menggunakan PIN.`
                  : `This will immediately terminate ${otherSessions.length} active sessions on other devices. Users will need to log back in.`}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmRevokeOthers(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {isIndo ? "Batal" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handleRevokeOthers}
              disabled={processingId === "others"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              {processingId === "others" && (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              )}
              <span>{isIndo ? "Ya, Keluarkan Semua" : "Yes, Revoke All"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="space-y-4">
        {/* Current Device Card */}
        {currentSession ? (
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {isIndo ? "Perangkat Saat Ini" : "Current Device"}
            </label>
            <div className="p-4 rounded-xl border-2 border-blue-500/30 bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {getDeviceIcon(currentSession.deviceType, "w-5 h-5")}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-bold text-slate-900">
                      {currentSession.deviceName || "Perangkat Ini"}
                    </h4>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                      {isIndo ? "Perangkat Ini" : "This Device"}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 flex-wrap">
                    <span className="flex items-center gap-1">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <strong className="text-slate-700">
                        {currentSession.userName}
                      </strong>{" "}
                      ({currentSession.username})
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="flex items-center gap-1 text-blue-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {isIndo ? "Aktif sekarang" : "Active now"}
                    </span>
                    {currentSession.ipAddress && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          {currentSession.ipAddress}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {isIndo ? "Mulai sesi:" : "Session started:"}{" "}
                      {formatDateTime(currentSession.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col items-end justify-between sm:justify-center">
                <span className="text-[11px] font-medium text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-md">
                  {isIndo ? "Sesi Aktif Utama" : "Primary Active Session"}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Laptop className="w-6 h-6 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {isIndo ? "Perangkat Ini" : "This Device"}
                </p>
                <p className="text-xs text-slate-500">
                  {currentUser?.name} ({currentUser?.username})
                </p>
              </div>
            </div>
            <span className="text-xs text-blue-600 font-medium">
              {isIndo ? "Aktif" : "Active"}
            </span>
          </div>
        )}

        {/* Other Connected Devices */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isIndo
                ? "Perangkat Lain yang Terhubung"
                : "Other Connected Devices"}
            </label>
            <span className="text-xs text-slate-400">
              {otherSessions.length} {isIndo ? "perangkat" : "device(s)"}
            </span>
          </div>

          {otherSessions.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-600">
                {isIndo
                  ? "Tidak ada perangkat lain yang terhubung"
                  : "No other devices connected"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {isIndo
                  ? "Akun Anda hanya aktif pada perangkat ini saat ini."
                  : "Your account is currently only active on this device."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherSessions.map((s) => (
                <div
                  key={s.id}
                  className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                        {getDeviceIcon(s.deviceType, "w-5 h-5")}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900">
                            {s.deviceName}
                          </h4>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            {s.deviceType.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                            <strong className="text-slate-700">
                              {s.userName}
                            </strong>{" "}
                            ({s.username})
                          </span>
                          <span className="text-slate-300">•</span>
                          <span
                            className="flex items-center gap-1 text-slate-500"
                            title={formatDateTime(s.lastActive)}
                          >
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {isIndo ? "Aktif" : "Active"}{" "}
                            {formatRelativeTime(s.lastActive)}
                          </span>
                          {s.ipAddress && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="flex items-center gap-1 text-slate-400">
                                <Globe className="w-3.5 h-3.5" />
                                {s.ipAddress}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1">
                          {isIndo ? "Tersambung sejak:" : "Connected since:"}{" "}
                          {formatDateTime(s.createdAt)}
                        </div>
                      </div>
                    </div>

                    {/* Force Logout Action */}
                    <div className="flex items-center sm:self-center">
                      {confirmSessionId === s.id ? (
                        <div className="flex items-center gap-2 bg-rose-50 p-2 rounded-lg border border-rose-200">
                          <span className="text-xs font-semibold text-rose-800">
                            {isIndo ? "Putus sesi?" : "Force logout?"}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevoke(s.id)}
                            disabled={processingId === s.id}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors flex items-center gap-1"
                          >
                            {processingId === s.id && (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            )}
                            <span>{isIndo ? "Ya" : "Yes"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmSessionId(null)}
                            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-800"
                          >
                            {isIndo ? "Batal" : "Cancel"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmSessionId(s.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-all"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{isIndo ? "Putus Sesi" : "Force Logout"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Security notice footer */}
      <div className="pt-4 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500 bg-slate-50/70 p-3 rounded-lg">
        <Lock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p>
          {isIndo
            ? 'Jika Anda melihat perangkat atau aktivitas yang mencurigakan, segera klik "Putus Sesi" untuk mengeluarkan akun tersebut dari sistem dan perbarui PIN Anda di menu Pengguna.'
            : 'If you notice unfamiliar devices or suspicious activities, click "Force Logout" immediately to disconnect them and update your PIN in the Users section.'}
        </p>
      </div>
    </div>
  );
};
