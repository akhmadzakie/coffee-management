import re

with open('src/components/Layout.tsx', 'r') as f:
    content = f.read()

content = content.replace("    ];\n  return (", "    ];\n  }\n  return (")

with open('src/components/Layout.tsx', 'w') as f:
    f.write(content)
