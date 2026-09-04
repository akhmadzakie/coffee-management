import re

with open('src/components/Sales.tsx', 'r') as f:
    content = f.read()

dropdown_old = """              {/* Sales Agent Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndo ? 'Sales Lapangan / Agen Komisi (Opsional)' : 'Sales Agent / Commission (Optional)'}
                </label>
                <select
                  value={dashboardAgentId}
                  onChange={(e) => setDashboardAgentId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs sm:text-sm bg-white"
                >
                  <option value="">{isIndo ? '-- Tanpa Sales Agent (Direct) --' : '-- No Sales Agent (Direct) --'}</option>
                  {salesAgents.filter(a => a.isActive).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.commissionType === 'PERCENTAGE' ? `Komisi ${a.commissionRate}%` : `Komisi ${formatCurrency(a.commissionRate)}/item`})
                    </option>
                  ))}
                </select>
              </div>"""

dropdown_new = """              {/* Sales Agent Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isIndo ? 'Sales Bertugas' : 'Assigned Sales Agent'}
                </label>
                {isCashier && mySalesAgentId ? (
                   <div className="w-full bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-semibold flex items-center">
                     <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
                     {salesAgents.find(a => a.id === mySalesAgentId)?.name || 'Profil Tidak Ditemukan'}
                   </div>
                ) : (
                  <select
                    value={dashboardAgentId}
                    onChange={(e) => setDashboardAgentId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs sm:text-sm bg-white"
                  >
                    <option value="">{isIndo ? '-- Tanpa Sales Agent (Direct) --' : '-- No Sales Agent (Direct) --'}</option>
                    {salesAgents.filter(a => a.isActive).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.commissionType === 'PERCENTAGE' ? `Komisi ${a.commissionRate}%` : `Komisi ${formatCurrency(a.commissionRate)}/item`})
                      </option>
                    ))}
                  </select>
                )}
              </div>"""

if dropdown_old in content:
    content = content.replace(dropdown_old, dropdown_new)
else:
    print("STILL NOT FOUND")

with open('src/components/Sales.tsx', 'w') as f:
    f.write(content)
