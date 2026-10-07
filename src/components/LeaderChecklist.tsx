import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { CheckSquare, Square, Save, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { getLocalDateString } from "../utils/dateUtils";

const LEADER_BAR_TASKS = [
  "Pekerjaan Kebersihan (Area Bar, Outdoor, WC, Smoking Area, Mushala, Gudang, dll)",
  "Pekerjaan Kontroling Alat (Mesin Espresso, Grinder, AC, Tablet, dll)",
  "Pekerjaan Kontroling Konstruksi (Cek atap bocor, kaca pecah, dll)",
  "Pekerjaan Gudang (Cek EXP semua bahan, fifo, dll)",
  "Pekerjaan Kontroling Serving (Kelengkapan serving minuman)",
  "Pekerjaan Kontroling Karyawan (Kasir, Bar Belakang, Absensi)"
];

const LEADER_KITCHEN_TASKS = [
  "Pekerjaan Kebersihan (Area Kitchen, Lantai, Exhaust, dll)",
  "Pekerjaan Kontroling Alat (Kompor, Chiller, Freezer, Fryer, dll)",
  "Pekerjaan Gudang (Cek EXP bahan makanan, fifo, stok, dll)",
  "Pekerjaan Kontroling Serving (Plating, Standar Resep)",
  "Pekerjaan Kontroling Karyawan (Koki, Helper, Cuci Piring)"
];

export const LeaderChecklist = () => {
  const { currentUser, dailyChecklists, setDailyChecklists, settings, isReadOnly } = useStore();
  const initialRole = currentUser?.role === "KITCHEN" ? "KITCHEN" : "BAR";
  const [selectedRole, setSelectedRole] = useState<"BAR" | "KITCHEN">(initialRole);
  
  const today = getLocalDateString();
  
  // Find current user's checklist for today
  const existingChecklist = dailyChecklists.find(
    (c) => c.employeeId === currentUser?.id && c.date.startsWith(today)
  );

  const [completedTasks, setCompletedTasks] = useState<string[]>(
    existingChecklist?.leaderTasks || []
  );

  const [isSaved, setIsSaved] = useState(false);

  const tasks = selectedRole === "BAR" 
    ? (settings.leaderBarTasks && settings.leaderBarTasks.length > 0 ? settings.leaderBarTasks : LEADER_BAR_TASKS)
    : (settings.leaderKitchenTasks && settings.leaderKitchenTasks.length > 0 ? settings.leaderKitchenTasks : LEADER_KITCHEN_TASKS);

  const toggleTask = (task: string) => {
    if (isReadOnly) return;
    setIsSaved(false);
    setCompletedTasks((prev) => 
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    );
  };

  const handleSave = () => {
    if (isReadOnly || !currentUser) return;
    
    const newChecklist = {
      id: existingChecklist?.id || crypto.randomUUID(),
      employeeId: currentUser.id,
      date: today,
      cleaningDone: existingChecklist?.cleaningDone || false,
      equipmentChecked: existingChecklist?.equipmentChecked || false,
      leaderTasks: completedTasks,
      notes: existingChecklist?.notes || ""
    };

    if (existingChecklist) {
      setDailyChecklists(
        dailyChecklists.map((c) => (c.id === newChecklist.id ? newChecklist : c))
      );
    } else {
      setDailyChecklists([...dailyChecklists, newChecklist]);
    }
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  if (!currentUser) return <div>Silakan login terlebih dahulu.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Checklist Leader</h2>
          <p className="text-gray-400 text-sm">
            Tugas harian khusus untuk Head Bar dan Head Kitchen.
          </p>
        </div>
        
        {(!currentUser || !["BAR", "KITCHEN"].includes(currentUser.role)) && (
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setSelectedRole("BAR")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedRole === "BAR"
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Head Bar
          </button>
          <button
            onClick={() => setSelectedRole("KITCHEN")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedRole === "KITCHEN"
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Head Kitchen
            </button>
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-xl font-bold text-amber-500">
            Tugas Harian - {selectedRole === "BAR" ? "Bar" : "Kitchen"}
          </h3>
          <span className="px-3 py-1 bg-gray-700 rounded-full text-sm">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        <div className="space-y-3 mb-8">
          {tasks.map((task, index) => (
            <div 
              key={index}
              onClick={() => toggleTask(task)}
              className={`p-4 rounded-lg border flex items-start gap-4 cursor-pointer transition-colors ${
                completedTasks.includes(task)
                  ? "bg-amber-500/10 border-amber-500/30"
                  : "bg-gray-900 border-gray-700 hover:border-gray-600"
              }`}
            >
              <div className="mt-0.5">
                {completedTasks.includes(task) ? (
                  <CheckSquare className="w-5 h-5 text-amber-500" />
                ) : (
                  <Square className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div>
                <p className={`font-medium ${completedTasks.includes(task) ? "text-amber-500" : "text-gray-200"}`}>
                  {task.split(" (")[0]}
                </p>
                {task.includes("(") && (
                  <p className="text-sm text-gray-500 mt-1">
                    {task.substring(task.indexOf("("))}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {!isReadOnly && (
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors"
            >
              <Save className="w-5 h-5" />
              Simpan Checklist
            </button>
            {isSaved && (
              <motion.span 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-green-500 text-sm font-medium flex items-center gap-1"
              >
                <CheckSquare className="w-4 h-4" /> Tersimpan!
              </motion.span>
            )}
          </div>
        )}
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-200">
          <p className="font-medium mb-1">Informasi Bonus Leader</p>
          <p>
            Mencatat penyelesaian tugas secara rutin setiap hari akan otomatis
            dihitung oleh sistem dalam menu <strong>Payroll</strong> pada akhir bulan
            sebagai acuan pemberian bonus KPI.
          </p>
        </div>
      </div>
    </div>
  );
};
