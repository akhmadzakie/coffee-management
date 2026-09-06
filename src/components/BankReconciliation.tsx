import React, { useState, useMemo } from 'react';
import { useStore } from '../store/StoreContext';
import { BankReconciliation } from '../types';

const generateId = () => {
  return "id_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
};

// Simplified formatCurrency and formatDate if not imported
const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(val);
const formatDate = (dateStr: string) => {
  try {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
};

const BankReconciliationComponent: React.FC = () => {
  const { 
    cashAccounts, 
    cashTransactions, 
    bankReconciliations,
    bankStatementLines,
    addBankReconciliation,
    addBankStatementLine,
    updateBankReconciliation,
    currentUser 
  } = useStore();

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7) // YYYY-MM
  );
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadedLines, setUploadedLines] = useState<any[]>([]);
  
  const selectedAccount = cashAccounts.find(a => a.id === selectedAccountId);

  // Retrieve existing reconciliation for selected account and period
  const existingReconciliation = useMemo(() => {
    return bankReconciliations.find(r => r.accountNumber === selectedAccountId && r.period === period);
  }, [bankReconciliations, selectedAccountId, period]);

  const existingLines = useMemo(() => {
    if (!existingReconciliation) return [];
    return bankStatementLines.filter(l => l.reconciliationId === existingReconciliation.id);
  }, [bankStatementLines, existingReconciliation]);

  // Handle CSV Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        // Simple CSV parser
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        if (lines.length === 0) return;
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const parsed = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim());
          const obj: any = {};
          headers.forEach((h, i) => {
            obj[h] = cols[i];
          });
          return obj;
        });
        setUploadedLines(parsed);
      };
      reader.readAsText(file);
    }
  };

  const processUpload = () => {
    if (!selectedAccount || uploadedLines.length === 0) return;
    
    // Create new draft reconciliation
    const reconciliationId = generateId();
    const newRecon: BankReconciliation = {
      id: reconciliationId,
      period,
      bankName: selectedAccount.name,
      accountNumber: selectedAccountId,
      openingBalance: 0,
      closingBalance: 0,
      status: 'DRAFT',
      notes: 'Uploaded from CSV',
      createdBy: currentUser?.name || 'System',
      createdAt: new Date().toISOString()
    };
    
    addBankReconciliation(newRecon);
    
    // Auto matching logic
    // We get cash transactions for this account and period
    const sysTrx = cashTransactions.filter(t => 
      t.accountId === selectedAccountId && 
      t.date.startsWith(period)
    );
    
    uploadedLines.forEach(line => {
      // Assuming standard CSV: date, description, amount, type
      const date = line.date || line.tanggal || new Date().toISOString();
      const amount = parseFloat(line.amount || line.jumlah || '0');
      const desc = line.description || line.deskripsi || line.keterangan || '';
      const type = (line.type || line.tipe || '').toUpperCase() === 'CREDIT' || amount > 0 ? 'CREDIT' : 'DEBIT';
      
      const absAmount = Math.abs(amount);
      
      // Attempt auto-match
      let matchedId = null;
      let isMatched = false;
      
      const potentialMatch = sysTrx.find(t => 
        t.amount === absAmount && 
        (t.type === 'CASH_IN' ? 'CREDIT' : 'DEBIT') === type
      );
      
      if (potentialMatch) {
        matchedId = potentialMatch.id;
        isMatched = true;
      }
      
      addBankStatementLine({
        id: generateId(),
        reconciliationId,
        date,
        description: desc,
        amount: absAmount,
        transactionType: type as 'CREDIT' | 'DEBIT',
        isMatched,
        matchedTransactionId: matchedId,
        createdAt: new Date().toISOString()
      });
    });
    
    setCsvFile(null);
    setUploadedLines([]);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Rekonsiliasi Bank</h1>
      
      <div className="bg-white p-4 rounded shadow mb-6 flex gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Akun Kas / Bank</label>
          <select 
            className="border p-2 rounded w-64"
            value={selectedAccountId}
            onChange={e => setSelectedAccountId(e.target.value)}
          >
            <option value="">-- Pilih Akun --</option>
            {cashAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
          <input 
            type="month" 
            className="border p-2 rounded"
            value={period}
            onChange={e => setPeriod(e.target.value)}
          />
        </div>
      </div>
      
      {selectedAccountId && (
        <div className="bg-white p-4 rounded shadow">
          {!existingReconciliation ? (
            <div>
              <h2 className="text-lg font-semibold mb-4">Mulai Rekonsiliasi Baru</h2>
              <p className="text-sm text-gray-600 mb-4">Upload mutasi bank Anda dalam format CSV (kolom wajib: <code>date</code>, <code>description</code>, <code>amount</code>, <code>type</code>).</p>
              
              <div className="flex gap-4 items-center">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="border p-2 rounded"
                />
                <button 
                  onClick={processUpload}
                  disabled={!csvFile || uploadedLines.length === 0}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Proses & Auto-Match
                </button>
              </div>
              
              {uploadedLines.length > 0 && (
                <p className="text-sm text-green-600 mt-2">Berhasil membaca {uploadedLines.length} baris dari CSV.</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">
                  Status Rekonsiliasi: 
                  <span className={`ml-2 px-2 py-1 text-sm rounded ${existingReconciliation.status === 'FINAL' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {existingReconciliation.status}
                  </span>
                </h2>
                {existingReconciliation.status === 'DRAFT' && (
                  <button 
                    onClick={() => updateBankReconciliation({...existingReconciliation, status: 'FINAL'})}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  >
                    Finalisasi Rekonsiliasi
                  </button>
                )}
              </div>
              
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Tanggal Bank</th>
                    <th className="p-2 border">Deskripsi Bank</th>
                    <th className="p-2 border text-right">Nominal</th>
                    <th className="p-2 border">Tipe</th>
                    <th className="p-2 border text-center">Status Match</th>
                  </tr>
                </thead>
                <tbody>
                  {existingLines.map(line => (
                    <tr key={line.id} className="border-b">
                      <td className="p-2">{formatDate(line.date)}</td>
                      <td className="p-2">{line.description}</td>
                      <td className="p-2 text-right">{formatCurrency(line.amount)}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-1 rounded ${line.transactionType === 'CREDIT' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {line.transactionType}
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        {line.isMatched ? (
                          <span className="text-green-600 font-bold">✓ Matched</span>
                        ) : (
                          <span className="text-red-500 font-bold">✗ Unmatched</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {existingLines.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">Tidak ada data mutasi.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BankReconciliationComponent;
