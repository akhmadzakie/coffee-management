import re

with open('src/components/Dashboard.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
content = content.replace("LineChart, Line", "LineChart, Line, AreaChart, Area, Legend")

# 2. Add data generation logic
data_logic = """
  const getSalesTrendsData = () => {
    if (filterMonth === -1) {
      return Array.from({ length: 12 }, (_, i) => {
        const m = new Date(filterYear, i, 1);
        const mStr = format(m, 'yyyy-MM');
        const sales = invoices.filter(inv => inv.date.startsWith(mStr)).reduce((sum, inv) => sum + inv.totalAmount, 0);
        return { name: format(m, 'MMM'), Sales: sales };
      });
    } else {
      const numDays = new Date(filterYear, filterMonth + 1, 0).getDate();
      return Array.from({ length: numDays }, (_, i) => {
        const d = new Date(filterYear, filterMonth, i + 1);
        const dayStr = format(d, 'yyyy-MM-dd');
        const sales = invoices.filter(inv => inv.date.startsWith(dayStr)).reduce((sum, inv) => sum + inv.totalAmount, 0);
        return { name: format(d, 'dd MMM'), Sales: sales };
      });
    }
  };
  const salesTrendsData = getSalesTrendsData();

  const getInventoryTurnoverData = () => {
    if (filterMonth === -1) {
      return Array.from({ length: 12 }, (_, i) => {
        const m = new Date(filterYear, i, 1);
        const mStr = format(m, 'yyyy-MM');
        const invIn = inventory.filter(inv => inv.date.startsWith(mStr) && (inv.type === 'IN' || inv.type === 'RETURN_IN')).reduce((sum, inv) => sum + Math.abs(inv.quantity), 0);
        const invOut = inventory.filter(inv => inv.date.startsWith(mStr) && (inv.type === 'OUT' || inv.type === 'RETURN_OUT')).reduce((sum, inv) => sum + Math.abs(inv.quantity), 0);
        return { name: format(m, 'MMM'), In: invIn, Out: invOut };
      });
    } else {
      const numDays = new Date(filterYear, filterMonth + 1, 0).getDate();
      return Array.from({ length: numDays }, (_, i) => {
        const d = new Date(filterYear, filterMonth, i + 1);
        const dayStr = format(d, 'yyyy-MM-dd');
        const invIn = inventory.filter(inv => inv.date.startsWith(dayStr) && (inv.type === 'IN' || inv.type === 'RETURN_IN')).reduce((sum, inv) => sum + Math.abs(inv.quantity), 0);
        const invOut = inventory.filter(inv => inv.date.startsWith(dayStr) && (inv.type === 'OUT' || inv.type === 'RETURN_OUT')).reduce((sum, inv) => sum + Math.abs(inv.quantity), 0);
        return { name: format(d, 'dd MMM'), In: invIn, Out: invOut };
      });
    }
  };
  const inventoryTurnoverData = getInventoryTurnoverData();
"""
# insert before const handleExportDashboard = () => {
content = content.replace("  const handleExportDashboard = () => {", data_logic + "\n  const handleExportDashboard = () => {")

# 3. Add charts to UI
charts_ui = """
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="font-bold text-sm text-slate-900 mb-6 flex items-center">
             <TrendingUp className="w-4 h-4 mr-2 text-indigo-500" />
             Monthly Sales Trends
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendsData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => formatCurrency(val)} />
                <Tooltip 
                   cursor={{ stroke: '#94A3B8', strokeWidth: 1, strokeDasharray: '4 4' }}
                   contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                   formatter={(value: number) => [`${formatCurrency(value)}`, 'Sales Revenue']}
                />
                <Area type="monotone" dataKey="Sales" stroke="#6366F1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <h3 className="font-bold text-sm text-slate-900 mb-6 flex items-center">
             <Package className="w-4 h-4 mr-2 text-blue-500" />
             Inventory Turnover
          </h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryTurnoverData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip 
                   cursor={{ fill: '#F1F5F9' }}
                   contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="In" name="Stock In" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Out" name="Stock Out" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
"""
# insert after <div className="grid grid-cols-1 lg:grid-cols-12 gap-6"> ... </div>
insert_ui_target = "      <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-6\">"
content = content.replace(insert_ui_target, charts_ui + "\n" + insert_ui_target)

with open('src/components/Dashboard.tsx', 'w') as f:
    f.write(content)

