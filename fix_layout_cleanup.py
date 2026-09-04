import re

with open('src/components/Layout.tsx', 'r') as f:
    content = f.read()

# Let's use regex to find the start of `let navigation =` to the `return (`
start_str = "    return () => document.removeEventListener('mousedown', handleClickOutside);\n  }, []);"
end_str = "  return (\n    <div className=\"min-h-screen bg-slate-50 flex\">"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx != -1 and end_idx != -1:
    clean_nav = """    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let navigation = [
    { name: t('dashboard'), view: 'dashboard' as ViewState, icon: LayoutDashboard },
    { name: t('products'), view: 'products' as ViewState, icon: Package },
    { name: t('clients'), view: 'clients' as ViewState, icon: Users },
    { name: t('suppliers'), view: 'suppliers' as ViewState, icon: Truck },
    { name: t('inventory'), view: 'inventory' as ViewState, icon: Warehouse },
    { name: t('sales'), view: 'sales' as ViewState, icon: ReceiptText },
    { name: t('purchases'), view: 'purchases' as ViewState, icon: ShoppingBag },
    { name: t('finance'), view: 'finance' as ViewState, icon: Wallet },
    { name: t('commissions'), view: 'commissions' as ViewState, icon: BadgePercent },
    { name: 'Pengguna', view: 'users' as ViewState, icon: ShieldCheck },
    { name: t('settings'), view: 'settings' as ViewState, icon: Settings },
  ];
  if (currentUser?.role === 'CASHIER') {
    navigation = [
      { name: t('dashboard'), view: 'dashboard' as ViewState, icon: LayoutDashboard },
      { name: t('sales'), view: 'sales' as ViewState, icon: ReceiptText },
      { name: t('inventory'), view: 'inventory' as ViewState, icon: Warehouse },
    ];
  } else if (currentUser?.role === 'MANAGER') {
    navigation = [
      { name: t('dashboard'), view: 'dashboard' as ViewState, icon: LayoutDashboard },
      { name: t('products'), view: 'products' as ViewState, icon: Package },
      { name: t('clients'), view: 'clients' as ViewState, icon: Users },
      { name: t('suppliers'), view: 'suppliers' as ViewState, icon: Truck },
      { name: t('inventory'), view: 'inventory' as ViewState, icon: Warehouse },
      { name: t('sales'), view: 'sales' as ViewState, icon: ReceiptText },
      { name: t('purchases'), view: 'purchases' as ViewState, icon: ShoppingBag },
      { name: t('finance'), view: 'finance' as ViewState, icon: Wallet },
      { name: t('commissions'), view: 'commissions' as ViewState, icon: BadgePercent },
    ];
  }

"""
    content = content[:start_idx] + clean_nav + content[end_idx:]
    with open('src/components/Layout.tsx', 'w') as f:
        f.write(content)
else:
    print("Could not find boundaries")
