import re

with open('src/components/Layout.tsx', 'r') as f:
    content = f.read()

nav_old = """    { name: t('commissions'), view: 'commissions' as ViewState, icon: BadgePercent },
    { name: t('settings'), view: 'settings' as ViewState, icon: Settings },
  ];"""

nav_new = """    { name: t('commissions'), view: 'commissions' as ViewState, icon: BadgePercent },
    { name: 'Pengguna', view: 'users' as ViewState, icon: ShieldCheck },
    { name: t('settings'), view: 'settings' as ViewState, icon: Settings },
  ];"""

content = content.replace(nav_old, nav_new)

if "else if (currentUser?.role === 'ADMIN')" in content:
    content = content.replace("""  } else if (currentUser?.role === 'ADMIN') {
    navigation.splice(navigation.length - 1, 0, { name: 'Pengguna', view: 'users' as ViewState, icon: ShieldCheck });
  }""", "")

with open('src/components/Layout.tsx', 'w') as f:
    f.write(content)
