import React, { useState } from 'react';
import { useStore } from '../store/StoreContext';
import { Search, Activity, Shield } from 'lucide-react';

export const AuditLogViewer = () => {
  const { auditLogs, users } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter(log => 
    log.tableName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Sistem Audit Log</h2>
              <p className="text-sm text-slate-500">Rekaman aktivitas pengguna pada sistem</p>
            </div>
          </div>
          
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari log..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600">Waktu</th>
                <th className="p-4 font-semibold text-slate-600">Pengguna</th>
                <th className="p-4 font-semibold text-slate-600">Aksi</th>
                <th className="p-4 font-semibold text-slate-600">Tabel</th>
                <th className="p-4 font-semibold text-slate-600">ID Referensi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                const user = users.find(u => u.id === log.userId);
                return (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-slate-800">
                      {new Date(log.timestamp).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{user?.name || 'Sistem / Tidak Diketahui'}</div>
                      <div className="text-xs text-slate-500">{user?.role || '-'}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                        log.action === 'UPDATE' ? 'bg-amber-100 text-amber-800' :
                        log.action === 'DELETE' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">{log.tableName}</td>
                    <td className="p-4 text-slate-500 text-sm font-mono">{log.recordId || '-'}</td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Tidak ada catatan log ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
