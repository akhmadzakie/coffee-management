import React, { useState } from "react";
import { Plus, Edit2, Trash2, Save, X } from "lucide-react";
import { useStore } from "../store/StoreContext";

export const KPI: React.FC = () => {
  const { kpiTasks, employees, updateKpiTask, kpiBonusRules, updateKpiBonusRule, user } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<"tasks" | "rules">("tasks");
  const isIndo = true;
  const canEditHR = user?.role === "OWNER" || user?.role === "MANAGER";

  // State for new/edit task
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState<any>({});

  // State for new/edit rule
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<any>({});

  const handleEditTask = (task: any) => {
    setEditingTaskId(task.id);
    setTaskForm({ ...task });
  };

  const handleSaveTask = () => {
    const id = editingTaskId || `kpi-task-${Date.now()}`;
    // Calculate score
    const realization = parseFloat(taskForm.realization) || 0;
    const target = parseFloat(taskForm.target) || 1;
    const weight = parseFloat(taskForm.weight) || 0;
    const score = Math.min((realization / target) * weight, weight);
    
    updateKpiTask(id, {
      ...taskForm,
      realization,
      target,
      weight,
      score,
      createdAt: taskForm.createdAt || new Date().toISOString(),
    });
    setEditingTaskId(null);
    setTaskForm({});
  };

  const handleEditRule = (rule: any) => {
    setEditingRuleId(rule.id);
    setRuleForm({ ...rule });
  };

  const handleSaveRule = () => {
    const id = editingRuleId || `kpi-rule-${Date.now()}`;
    updateKpiBonusRule(id, {
      ...ruleForm,
      minScore: parseFloat(ruleForm.minScore) || 0,
      maxScore: parseFloat(ruleForm.maxScore) || 0,
      bonusAmount: parseFloat(ruleForm.bonusAmount) || 0,
      isActive: ruleForm.isActive ?? true,
    });
    setEditingRuleId(null);
    setRuleForm({});
  };

  const getEmployeeName = (id: string) => {
    return employees.find(e => e.id === id)?.name || id;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="border-b border-slate-200 bg-slate-50 p-4">
        <h2 className="text-xl font-bold text-slate-800">
          KPI & Bonus Management
        </h2>
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setActiveSubTab("tasks")}
            className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeSubTab === "tasks"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Daftar Task KPI
          </button>
          <button
            onClick={() => setActiveSubTab("rules")}
            className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeSubTab === "rules"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Aturan Bonus (Tiered)
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeSubTab === "tasks" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Task KPI Karyawan</h3>
              {canEditHR && (
                <button 
                  onClick={() => { setEditingTaskId(""); setTaskForm({ period: new Date().toISOString().slice(0, 7) }); }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" /> Tambah Task
                </button>
              )}
            </div>
            
            {editingTaskId !== null && (
              <div className="bg-indigo-50 p-4 rounded-lg mb-6 border border-indigo-100">
                <h4 className="font-medium text-indigo-900 mb-4">{editingTaskId ? "Edit Task" : "Task Baru"}</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Karyawan</label>
                    <select
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={taskForm.employeeId || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, employeeId: e.target.value })}
                    >
                      <option value="">Pilih Karyawan</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Periode (YYYY-MM)</label>
                    <input
                      type="month"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={taskForm.period || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, period: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-600 mb-1">Nama Task / Target</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={taskForm.taskName || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, taskName: e.target.value })}
                      placeholder="Contoh: Penjualan Kopi > 100 cup"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Target</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={taskForm.target || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, target: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Realisasi</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={taskForm.realization || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, realization: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Bobot (%)</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={taskForm.weight || ""}
                      onChange={(e) => setTaskForm({ ...taskForm, weight: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingTaskId(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white">Batal</button>
                  <button onClick={handleSaveTask} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2"><Save className="w-4 h-4" /> Simpan</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                    <th className="py-3 px-4 font-semibold">Periode</th>
                    <th className="py-3 px-4 font-semibold">Karyawan</th>
                    <th className="py-3 px-4 font-semibold">Nama Task</th>
                    <th className="py-3 px-4 font-semibold text-center">Target</th>
                    <th className="py-3 px-4 font-semibold text-center">Realisasi</th>
                    <th className="py-3 px-4 font-semibold text-center">Bobot</th>
                    <th className="py-3 px-4 font-semibold text-center">Skor</th>
                    <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiTasks?.map(task => (
                    <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">{task.period}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{getEmployeeName(task.employeeId)}</td>
                      <td className="py-3 px-4 text-slate-600">{task.taskName}</td>
                      <td className="py-3 px-4 text-center">{task.target}</td>
                      <td className="py-3 px-4 text-center font-medium">{task.realization}</td>
                      <td className="py-3 px-4 text-center">{task.weight}%</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">{task.score?.toFixed(1)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => handleEditTask(task)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {(!kpiTasks || kpiTasks.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500 italic">Belum ada data Task KPI</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === "rules" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Aturan Bonus (Tiered)</h3>
              {canEditHR && (
                <button 
                  onClick={() => { setEditingRuleId(""); setRuleForm({ isActive: true }); }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" /> Tambah Aturan
                </button>
              )}
            </div>
            
            {editingRuleId !== null && (
              <div className="bg-indigo-50 p-4 rounded-lg mb-6 border border-indigo-100">
                <h4 className="font-medium text-indigo-900 mb-4">{editingRuleId ? "Edit Aturan" : "Aturan Baru"}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Skor Minimal</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={ruleForm.minScore || ""}
                      onChange={(e) => setRuleForm({ ...ruleForm, minScore: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Skor Maksimal</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={ruleForm.maxScore || ""}
                      onChange={(e) => setRuleForm({ ...ruleForm, maxScore: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Bonus (Rp)</label>
                    <input
                      type="number"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      value={ruleForm.bonusAmount || ""}
                      onChange={(e) => setRuleForm({ ...ruleForm, bonusAmount: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingRuleId(null)} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 bg-white">Batal</button>
                  <button onClick={handleSaveRule} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-2"><Save className="w-4 h-4" /> Simpan</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-sm border-y border-slate-200">
                    <th className="py-3 px-4 font-semibold">Skor Minimal</th>
                    <th className="py-3 px-4 font-semibold">Skor Maksimal</th>
                    <th className="py-3 px-4 font-semibold">Jumlah Bonus (Rp)</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiBonusRules?.map(rule => (
                    <tr key={rule.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-700">{rule.minScore}</td>
                      <td className="py-3 px-4 text-slate-700">{rule.maxScore}</td>
                      <td className="py-3 px-4 text-emerald-600 font-mono font-medium">Rp {rule.bonusAmount.toLocaleString('id-ID')}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full ${rule.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {rule.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button onClick={() => handleEditRule(rule)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                  {(!kpiBonusRules || kpiBonusRules.length === 0) && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic">Belum ada aturan bonus.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
