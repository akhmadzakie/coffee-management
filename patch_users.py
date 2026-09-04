import re

with open('src/components/Users.tsx', 'r') as f:
    content = f.read()

# Make sure we import salesAgents from useStore
if "salesAgents" not in content:
    content = content.replace("const { users, addUser, updateUser, deleteUser, currentUser } = useStore();", "const { users, addUser, updateUser, deleteUser, currentUser, salesAgents } = useStore();")

# Update formData
form_data_old = """    const userData = {
      username: formData.get('username') as string,
      pin: formData.get('pin') as string,
      name: formData.get('name') as string,
      role: formData.get('role') as Role,
    };"""

form_data_new = """    const userData = {
      username: formData.get('username') as string,
      pin: formData.get('pin') as string,
      name: formData.get('name') as string,
      role: formData.get('role') as Role,
      linkedSalesAgentId: (formData.get('linkedSalesAgentId') as string) || undefined,
    };"""

content = content.replace(form_data_old, form_data_new)

# Render the linked Sales Agent mapping
role_select = """              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Peran (Role)</label>
                <select
                  name="role"
                  required
                  defaultValue={editingUser?.role || 'CASHIER'}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="CASHIER">Kasir (Otomatis Terekam Sebagai Sales)</option>
                  <option value="MANAGER">Manager (Dashboard, Purchases)</option>
                  <option value="ADMIN">Super Admin (All Access)</option>
                </select>
              </div>"""

linked_sales = """
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hubungkan Profil Sales</label>
                <p className="text-[10px] text-slate-500 mb-2 leading-tight">Pilih profil sales agar semua transaksi di kasir oleh pengguna ini otomatis masuk sebagai penjualannya.</p>
                <select
                  name="linkedSalesAgentId"
                  defaultValue={editingUser?.linkedSalesAgentId || ''}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                >
                  <option value="">-- Tidak Terhubung / Admin --</option>
                  {salesAgents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </div>
"""

content = content.replace(role_select, role_select + linked_sales)
content = content.replace("<option value=\"CASHIER\">Kasir (Sales & Inventory)</option>", "<option value=\"CASHIER\">Kasir / Sales Person (Penjualan)</option>")

with open('src/components/Users.tsx', 'w') as f:
    f.write(content)
