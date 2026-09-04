import re

with open('src/components/Sales.tsx', 'r') as f:
    content = f.read()

# Automatically link the current user to the POS dropdown
# Instead of a dropdown for Kasir to select Sales, we lock it.
content = content.replace("const [dashboardAgentId, setDashboardAgentId] = useState<string>('');", "const [dashboardAgentId, setDashboardAgentId] = useState<string>('');\n  \n  // Auto-link cashier to their sales profile\n  const isCashier = currentUser?.role === 'CASHIER';\n  const mySalesAgentId = currentUser?.linkedSalesAgentId;\n  const activeSalesAgentId = mySalesAgentId || dashboardAgentId;")

# Find where POS uses dashboardAgentId (for commission label) and replace it with activeSalesAgentId
content = content.replace("salesAgents.find(a => a.id === dashboardAgentId)?.name", "salesAgents.find(a => a.id === activeSalesAgentId)?.name")

# Also the POS checkout needs to use activeSalesAgentId
checkout_old = """    const newInvoice: Omit<Invoice, 'id'> = {
      invoiceNumber,
      date: new Date().toISOString(),
      clientId: selectedClient,
      items: cart,
      subtotal,
      discount: totalDiscount,
      totalAmount,
      status,
      payments: status === 'PAID' ? [{
        amount: totalAmount,
        method: 'TRANSFER', // default
        date: new Date().toISOString()
      }] : [],
    };"""

checkout_new = """    const newInvoice: Omit<Invoice, 'id'> = {
      invoiceNumber,
      date: new Date().toISOString(),
      clientId: selectedClient,
      items: cart,
      subtotal,
      discount: totalDiscount,
      totalAmount,
      status,
      salesAgentId: activeSalesAgentId,
      salesAgentName: salesAgents.find(a => a.id === activeSalesAgentId)?.name,
      commissionAmount: 0,
      payments: status === 'PAID' ? [{
        amount: totalAmount,
        method: 'TRANSFER', // default
        date: new Date().toISOString()
      }] : [],
    };
    
    // Calculate commission
    if (activeSalesAgentId) {
       const agent = salesAgents.find(a => a.id === activeSalesAgentId);
       if (agent) {
         if (agent.commissionType === 'PERCENTAGE') {
           newInvoice.commissionAmount = (newInvoice.totalAmount * agent.commissionRate) / 100;
         } else if (agent.commissionType === 'FIXED_PER_ITEM') {
           const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
           newInvoice.commissionAmount = totalItems * agent.commissionRate;
         }
       }
    }
"""

content = content.replace(checkout_old, checkout_new)


# Now for the UI: Remove the explicit Select Sales Agent dropdown if the user is a Cashier, OR just lock it.
dropdown_old = """                  <div className="text-sm">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{isIndo ? 'Pilih Sales Agent (Opsional)' : 'Select Sales Agent (Optional)'}</label>
                    <div className="relative">
                      <select 
                        value={dashboardAgentId}
                        onChange={(e) => setDashboardAgentId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium appearance-none"
                      >
                        <option value="">{isIndo ? '-- Tanpa Agen Sales --' : '-- No Sales Agent --'}</option>
                        {salesAgents.map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>"""

dropdown_new = """                  <div className="text-sm">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{isIndo ? 'Sales Bertugas' : 'Assigned Sales'}</label>
                    <div className="relative">
                      {isCashier && mySalesAgentId ? (
                        <div className="w-full bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2.5 font-bold flex items-center">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />
                          {salesAgents.find(a => a.id === mySalesAgentId)?.name || 'Profil Tidak Ditemukan'}
                        </div>
                      ) : (
                        <>
                          <select 
                            value={dashboardAgentId}
                            onChange={(e) => setDashboardAgentId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 font-medium appearance-none"
                          >
                            <option value="">{isIndo ? '-- Tanpa Agen Sales --' : '-- No Sales Agent --'}</option>
                            {salesAgents.map(agent => (
                              <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </>
                      )}
                    </div>
                  </div>"""

if dropdown_old in content:
    content = content.replace(dropdown_old, dropdown_new)
else:
    print("DROPDOWN NOT FOUND IN POS UI, NEED TO SEARCH FOR IT")


# And for the Dashboard tab:
# Force select the agent ID if it's a cashier
dash_dropdown_old = """               <select
                 className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                 value={dashboardAgentId}
                 onChange={(e) => setDashboardAgentId(e.target.value)}
               >
                 <option value="" disabled>{isIndo ? '-- Pilih Profil Sales --' : '-- Select Sales Profile --'}</option>
                 {salesAgents.map(agent => (
                   <option key={agent.id} value={agent.id}>{agent.name}</option>
                 ))}
               </select>"""

dash_dropdown_new = """               {isCashier && mySalesAgentId ? (
                 <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-2 font-bold text-sm flex items-center">
                   <TrendingUp className="w-4 h-4 mr-2" />
                   Profil: {salesAgents.find(a => a.id === mySalesAgentId)?.name}
                 </div>
               ) : (
                 <select
                   className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm"
                   value={dashboardAgentId}
                   onChange={(e) => setDashboardAgentId(e.target.value)}
                 >
                   <option value="" disabled>{isIndo ? '-- Pilih Profil Sales --' : '-- Select Sales Profile --'}</option>
                   {salesAgents.map(agent => (
                     <option key={agent.id} value={agent.id}>{agent.name}</option>
                   ))}
                 </select>
               )}"""

content = content.replace(dash_dropdown_old, dash_dropdown_new)


# Fix the selectedAgent logic in Dashboard
dashboard_logic_old = """      {activeTab === 'dashboard' && (() => {
        const selectedAgent = salesAgents.find(a => a.id === dashboardAgentId);"""

dashboard_logic_new = """      {activeTab === 'dashboard' && (() => {
        const selectedAgent = salesAgents.find(a => a.id === activeSalesAgentId);"""

content = content.replace(dashboard_logic_old, dashboard_logic_new)

with open('src/components/Sales.tsx', 'w') as f:
    f.write(content)

