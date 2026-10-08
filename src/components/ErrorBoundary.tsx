import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-800 rounded-2xl p-8 border border-red-900/30 text-center shadow-xl shadow-black/50">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-2">
              Oops! Terjadi Kesalahan
            </h1>
            
            <p className="text-gray-400 mb-6 text-sm">
              Sistem mendeteksi adanya error pada tampilan ini. Jangan khawatir, data Anda tetap aman.
            </p>
            
            {this.state.error && (
              <div className="bg-black/40 rounded border border-gray-700 p-3 mb-6 text-left overflow-auto max-h-32">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-primary text-brand-dark font-medium rounded-xl hover:bg-brand-primary/90 transition-colors"
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
