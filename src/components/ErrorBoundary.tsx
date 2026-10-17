import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Props;
  declare setState: (update: Partial<State> | ((prevState: State) => Partial<State>)) => void;

  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });

    const isChunkError =
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Importing a module script failed") ||
      error.message?.includes("error loading dynamically imported module") ||
      error.name === "ChunkLoadError";

    if (isChunkError) {
      const lastReload = sessionStorage.getItem("chunk_reload_attempted");
      const now = Date.now();
      // Jika belum pernah reload dalam 15 detik terakhir, auto-reload otomatis
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem("chunk_reload_attempted", now.toString());
        window.location.reload();
      }
    }
  }

  private handleReload = () => {
    // Clear cache reload marker and force reload
    sessionStorage.removeItem("chunk_reload_attempted");
    sessionStorage.removeItem("vite_chunk_reload");
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("Importing a module script failed") ||
        this.state.error?.message?.includes("error loading dynamically imported module") ||
        this.state.error?.name === "ChunkLoadError";

      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center shadow-xl shadow-black/50">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isChunkError ? "bg-brand-500/10" : "bg-red-500/10"
            }`}>
              {isChunkError ? (
                <RefreshCw className="w-8 h-8 text-brand-400" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-500" />
              )}
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              {isChunkError ? "Versi Baru Tersedia" : "Oops! Terjadi Kesalahan"}
            </h1>
            
            <p className="text-gray-300 mb-6 text-sm">
              {isChunkError
                ? "Sistem baru saja diperbarui dengan fitur terbaru. Silakan muat ulang halaman untuk memuat pembaruan."
                : "Sistem mendeteksi adanya kendala pada tampilan ini. Jangan khawatir, seluruh data Anda tetap aman."}
            </p>
            
            {this.state.error && !isChunkError && (
              <div className="bg-black/40 rounded-xl border border-gray-700/80 p-3 mb-6 text-left overflow-auto max-h-40">
                <p className="text-red-400 text-xs font-mono break-all font-semibold mb-1">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-gray-400 text-[10px] font-mono whitespace-pre-wrap leading-tight mt-1 border-t border-gray-700/50 pt-1">
                    {this.state.errorInfo.componentStack.trim()}
                  </pre>
                )}
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-600/20 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
