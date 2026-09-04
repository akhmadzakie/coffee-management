import re

with open('src/components/Sales.tsx', 'r') as f:
    content = f.read()

# Update state type
content = content.replace("useState<'pos' | 'history'>('pos')", "useState<'pos' | 'history' | 'dashboard'>('pos')")

# Add the Tab Button
tabs_old = """        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          } -mb-[17px]`}
        >
          {isIndo ? 'Riwayat Faktur' : 'Invoice History'}
        </button>"""

tabs_new = """        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'history' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          } -mb-[17px]`}
        >
          {isIndo ? 'Riwayat Faktur' : 'Invoice History'}
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'dashboard' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          } -mb-[17px] flex items-center`}
        >
          <TrendingUp className="w-4 h-4 mr-1.5" />
          {isIndo ? 'Dasbor Sales' : 'Sales Dashboard'}
        </button>"""
content = content.replace(tabs_old, tabs_new)


dashboard_render = """      {/* Dashboard View */}
      {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{isIndo ? 'Dasbor Kinerja Sales' : 'Sales Performance Dashboard'}</h3>
              <p className="text-sm text-slate-500">{isIndo ? 'Pantau target bulanan dan komisi Anda.' : 'Monitor your monthly targets and commissions.'}</p>
            </div>
            <div>
               <select
                 className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                 defaultValue=""
               >
                 <option value="" disabled>{isIndo ? '-- Pilih Profil Sales --' : '-- Select Sales Profile --'}</option>
                 {salesAgents.map(agent => (
                   <option key={agent.id} value={agent.id}>{agent.name}</option>
                 ))}
               </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Penjualan Bulan Ini' : 'Sales This Month'}</h3>
                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  Rp 0
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
                  Rp 0
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                  <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: '0%' }}></div>
                </div>
             </div>
             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Potensi Komisi' : 'Potential Commission'}</h3>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-emerald-600">
                  Rp 0
                </div>
                <div className="text-xs text-slate-400 mt-1">Pending payout</div>
             </div>
             <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{isIndo ? 'Total Faktur' : 'Total Invoices'}</h3>
                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  0
                </div>
                <div className="text-xs text-slate-400 mt-1">Transactions completed</div>
             </div>
          </div>
          
          <div className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col items-center justify-center py-16 text-center shadow-sm">
             <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
             <h4 className="text-lg font-bold text-slate-700">{isIndo ? 'Pilih Profil Sales' : 'Select a Sales Profile'}</h4>
             <p className="text-slate-500 text-sm mt-1 max-w-md">{isIndo ? 'Silakan pilih profil Anda pada menu tarik-turun di atas untuk memuat data kinerja Anda.' : 'Please select your profile from the dropdown above to load your performance data.'}</p>
          </div>
        </div>
      )}
"""

content = content.replace("{/* POS View */}", dashboard_render + "\n      {/* POS View */}")

# Make sure we add TrendingUp, DollarSign import
if "TrendingUp," not in content:
    content = content.replace("import { \n  Plus,", "import { \n  TrendingUp,\n  DollarSign,\n  Plus,")
else:
    # Check if DollarSign is there
    if "DollarSign," not in content:
        content = content.replace("TrendingUp,", "TrendingUp, DollarSign,")

with open('src/components/Sales.tsx', 'w') as f:
    f.write(content)
