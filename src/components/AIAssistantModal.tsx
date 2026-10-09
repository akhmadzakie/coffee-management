import React, { useState, useRef } from "react";
import { X, Upload, Sparkles, Loader2, Send } from "lucide-react";

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTransactions?: (transactions: any[]) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  isOpen,
  onClose,
  onApplyTransactions,
}) => {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const handleProcess = async () => {
    if (!text && !file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      let imageBase64 = null;
      let mimeType = null;

      if (file) {
        mimeType = file.type;
        const reader = new FileReader();
        const readPromise = new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const result = reader.result as string;
            // Remove the data:image/jpeg;base64, prefix
            const b64 = result.split(',')[1];
            resolve(b64);
          };
        });
        reader.readAsDataURL(file);
        imageBase64 = await readPromise;
      }

      const response = await fetch("http://localhost:3000/api/ai/parse-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, imageBase64, mimeType }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses data");

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan pada AI");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Magic AI Assistant</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600 mb-4">
            Ketikkan aktivitas pengeluaran/pemasukan Anda atau unggah foto nota belanja. AI akan otomatis membuatkan draf transaksinya untuk Anda.
          </p>

          <div className="space-y-4">
            <div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Contoh: Beli es batu 20rb pake Laci Kasir, trus bayar galon 15rb..."
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px] resize-none"
              />
            </div>

            <div>
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
                  className="w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition-colors flex flex-col items-center justify-center"
                >
                  <Upload className="w-6 h-6 mb-2" />
                  <span className="text-sm font-medium">Upload Foto Nota / Struk</span>
                </button>
              ) : (
                <div className="relative rounded-xl border border-slate-200 p-2">
                  <img src={previewUrl} alt="Preview" className="w-full h-48 object-contain rounded-lg" />
                  <button
                    onClick={() => { setFile(null); setPreviewUrl(null); }}
                    className="absolute top-4 right-4 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            {result && result.transactions && (
              <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Hasil AI (Draft Transaksi)
                </h4>
                <div className="space-y-2">
                  {result.transactions.map((tx: any, idx: number) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-green-100 flex justify-between items-center text-sm shadow-sm">
                      <div>
                        <p className="font-medium text-slate-800">{tx.description}</p>
                        <p className="text-xs text-slate-500">Kategori: {tx.category}</p>
                      </div>
                      <div className={`font-bold ${tx.type === 'CASH_OUT' ? 'text-red-600' : 'text-green-600'}`}>
                        {tx.type === 'CASH_OUT' ? '-' : '+'} Rp {tx.amount.toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
                
                {onApplyTransactions && (
                  <button 
                    onClick={() => {
                      onApplyTransactions(result.transactions);
                      onClose();
                    }}
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors"
                  >
                    Setujui & Simpan
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleProcess}
            disabled={isLoading || (!text && !file)}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Memproses...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" /> Proses dengan AI
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
