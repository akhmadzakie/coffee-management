import re

with open('src/components/Users.tsx', 'r') as f:
    content = f.read()

target = """                </select>
              </div>"""

replacement = """                </select>
              </div>
              
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
              </div>"""

content = content.replace(target, replacement)

with open('src/components/Users.tsx', 'w') as f:
    f.write(content)
