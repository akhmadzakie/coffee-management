import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# Add calculations if not exist
if "const totalSales =" not in content:
    calc_block = "const netProfit = totalCashIn - totalCashOut;"
    new_calc = """const netProfit = totalCashIn - totalCashOut;
  const totalSales = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const pendingCommissions = filteredInvoices
    .filter(inv => inv.commissionStatus === 'PENDING' || inv.commissionStatus === 'ELIGIBLE')
    .reduce((sum, inv) => sum + (inv.commissionAmount || 0), 0);
"""
    content = content.replace(calc_block, new_calc)

# Replace the 4 KPI cards
grid_start = '<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">'
grid_end = '      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">'

start_idx = content.find(grid_start)
end_idx = content.find(grid_end)

if start_idx != -1 and end_idx != -1:
    new_grid = """<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Sales</h3>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(totalSales)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total revenue generated</div>
        </div>
        
        {/* Metric 2 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Net Profit</h3>
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(netProfit)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Based on cash flow</div>
        </div>
        
        {/* Metric 3 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Current Inventory Value</h3>
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(totalRealCapitalAsset)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Based on cost price</div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pending Commissions</h3>
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
              <ReceiptText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(pendingCommissions)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Unpaid agent commissions</div>
        </div>
      </div>

"""
    content = content[:start_idx] + new_grid + content[end_idx:]

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)
