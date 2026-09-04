import re

with open('src/components/Sales.tsx', 'r') as f:
    content = f.read()

# Need to add state for selected sales agent
if "const [selectedSalesAgentId, setSelectedSalesAgentId] = useState<string>('');" not in content:
    content = content.replace("const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'dashboard'>('pos');", "const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'dashboard'>('pos');\n  const [selectedSalesAgentId, setSelectedSalesAgentId] = useState<string>('');")

# Prepare dynamic computation code
logic = """
          {/* Dashboard View */}
      {activeTab === 'dashboard' && (() => {
        const selectedAgent = salesAgents.find(a => a.id === selectedSalesAgentId);
        const currentMonthPrefix = new Date().toISOString().substring(0, 7); // 'yyyy-MM'
        
        let thisMonthSales = 0;
        let potentialCommission = 0;
        let invoiceCount = 0;
        
        if (selectedAgent) {
          const agentInvoices = invoices.filter(inv => inv.salesAgentId === selectedAgent.id && inv.date.startsWith(currentMonthPrefix));
          invoiceCount = agentInvoices.length;
          thisMonthSales = agentInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
          potentialCommission = agentInvoices.reduce((sum, inv) => sum + (inv.commissionAmount || 0), 0);
        }
        
        const target = selectedAgent?.monthlyTarget || 0;
        const progressRaw = target > 0 ? (thisMonthSales / target) * 100 : 0;
        const progress = Math.min(progressRaw, 100);

        return (
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{isIndo ? 'Dasbor Kinerja Sales' : 'Sales Performance Dashboard'}</h3>
              <p className="text-sm text-slate-500">{isIndo ? 'Pantau target bulanan dan komisi Anda.' : 'Monitor your monthly targets and commissions.'}</p>
            </div>
            <div>
               <select
                 className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                 value={selectedSalesAgentId}
                 onChange={(e) => setSelectedSalesAgentId(e.target.value)}
               >
                 <option value="" disabled>{isIndo ? '-- Pilih Profil Sales --' : '-- Select Sales Profile --'}</option>
                 {salesAgents.map(agent => (
                   <option key={agent.id} value={agent.id}>{agent.name}</option>
                 ))}
               </select>
            </div>
          </div>
          
          {selectedAgent ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Penjualan Bulan Ini' : 'Sales This Month'}</h3>
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(thisMonthSales)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Total revenue generated</div>
               </div>
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Target Bulanan' : 'Monthly Target'}</h3>
                    <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {target > 0 ? formatCurrency(target) : 'No target'}
                  </div>
                  {target > 0 && (
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 relative group">
                      <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div>
                      <span className="absolute -top-6 right-0 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">{progressRaw.toFixed(1)}%</span>
                    </div>
                  )}
               </div>
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Potensi Komisi' : 'Potential Commission'}</h3>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatCurrency(potentialCommission)}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Pending & Eligible payout</div>
               </div>
               <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Total Faktur' : 'Total Invoices'}</h3>
                    <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">
                    {invoiceCount}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">Transactions this month</div>
               </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4">{isIndo ? 'Faktur Anda Bulan Ini' : 'Your Invoices This Month'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">No. Faktur</th>
                      <th className="py-3 px-4">Klien</th>
                      <th className="py-3 px-4 text-right">Nilai Total</th>
                      <th className="py-3 px-4 text-right">Komisi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.filter(inv => inv.salesAgentId === selectedAgent.id && inv.date.startsWith(currentMonthPrefix)).map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-900">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 text-sm text-slate-700">{clients.find(c => c.id === inv.clientId)?.coffeeShop || 'Unknown'}</td>
                        <td className="py-3 px-4 text-sm font-bold text-slate-700 text-right">{formatCurrency(inv.totalAmount)}</td>
                        <td className="py-3 px-4 text-sm font-bold text-emerald-600 text-right">{formatCurrency(inv.commissionAmount || 0)}</td>
                      </tr>
                    ))}
                    {invoices.filter(inv => inv.salesAgentId === selectedAgent.id && inv.date.startsWith(currentMonthPrefix)).length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-sm text-slate-400 font-medium">Belum ada penjualan bulan ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            </>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center py-16 text-center shadow-sm">
               <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
               <h4 className="text-lg font-bold text-slate-700">{isIndo ? 'Pilih Profil Sales' : 'Select a Sales Profile'}</h4>
               <p className="text-slate-500 text-sm mt-1 max-w-md">{isIndo ? 'Silakan pilih profil Anda pada menu tarik-turun di atas untuk memuat data kinerja Anda.' : 'Please select your profile from the dropdown above to load your performance data.'}</p>
            </div>
          )}
        </div>
        );
      })()}
"""

# Now we need to replace the old {activeTab === 'dashboard' && (...)} block.
start_idx = content.find("{/* Dashboard View */}")
end_idx = content.find("{/* POS View */}")
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + logic + "\n      " + content[end_idx:]

with open('src/components/Sales.tsx', 'w') as f:
    f.write(content)
