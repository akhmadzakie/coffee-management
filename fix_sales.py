import re

with open('src/components/Sales.tsx', 'r') as f:
    content = f.read()

# Remove the one I added: "const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'dashboard'>('pos');\n  const [selectedSalesAgentId, setSelectedSalesAgentId] = useState<string>('');"
content = content.replace("const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'dashboard'>('pos');\n  const [selectedSalesAgentId, setSelectedSalesAgentId] = useState<string>('');", "const [activeTab, setActiveTab] = useState<'pos' | 'history' | 'dashboard'>('pos');\n  const [dashboardAgentId, setDashboardAgentId] = useState<string>('');")

# Update logic inside dashboard block
content = content.replace("salesAgents.find(a => a.id === selectedSalesAgentId)", "salesAgents.find(a => a.id === dashboardAgentId)")
content = content.replace("value={selectedSalesAgentId}", "value={dashboardAgentId}")
content = content.replace("onChange={(e) => setSelectedSalesAgentId(e.target.value)}", "onChange={(e) => setDashboardAgentId(e.target.value)}")

with open('src/components/Sales.tsx', 'w') as f:
    f.write(content)
