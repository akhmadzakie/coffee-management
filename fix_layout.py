import re

with open('src/components/Layout.tsx', 'r') as f:
    content = f.read()

# Let's just find the exact block and replace it
manager_block = """    { name: t('commissions'), view: 'commissions' as ViewState, icon: BadgePercent },
    ];
  return ("""

if manager_block in content:
    content = content.replace(manager_block, """    { name: t('commissions'), view: 'commissions' as ViewState, icon: BadgePercent },
    ];
  }
  return (""")
else:
    print("Exact block not found")

with open('src/components/Layout.tsx', 'w') as f:
    f.write(content)
