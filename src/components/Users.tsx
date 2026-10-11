import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { ShieldCheck, Plus, Trash2, Edit, UserCheck, AlertCircle, X, Link } from "lucide-react";
import { Role, User } from "../types";
import { useTranslation } from "../utils/i18n";
import { CsvImportExport } from "./common/CsvImportExport";
import { ConfirmModal, useConfirm } from "./common/ConfirmModal";

const ALL_ROLES: { value: string; label: string; description: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin",       description: "Akses penuh semua sistem" },
  { value: "OWNER",       label: "Owner / Pemilik",   description: "Pantau data, tidak bisa edit" },
  { value: "MANAGER",     label: "Manager",           description: "Kelola operasional & keuangan" },
  { value: "FINANCE",     label: "Finance / Keuangan", description: "Akses modul keuangan" },
  { value: "KASIR",       label: "Kasir",             description: "Shift, penjualan" },
  { value: "LEADER",      label: "Leader (Bar/Kitchen)", description: "Inventori & operasional" },
  { value: "BAR",         label: "Karyawan Bar",      description: "Akses absen" },
  { value: "KITCHEN",     label: "Karyawan Kitchen",  description: "Akses absen" },
  { value: "BAKER",       label: "Karyawan Baker",    description: "Akses absen" },
];

// Role yang boleh dibuat oleh MANAGER (tidak boleh escalate ke level atas)
const MANAGER_ALLOWED_ROLES = ["KASIR", "LEADER", "BAR", "KITCHEN", "BAKER"];

const DEPARTMENTS = [
  { value: "MAIN", label: "Gudang Utama" },
  { value: "BAR", label: "Bar" },
  { value: "KITCHEN", label: "Kitchen / Dapur" },
];

export const UsersComponent = () => {
  const { users, employees, addUser, updateUser, deleteUser, updateEmployee, currentUser, settings } =
    useStore();
  const { t } = useTranslation(settings.language || "id");
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const confirm = useConfirm();

  // Controlled form states for real-time synchronization
  const [formName, setFormName] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formRole, setFormRole] = useState<Role>("KASIR");
  const [formDept, setFormDept] = useState("BAR");
  const [formEmployeeId, setFormEmployeeId] = useState("");

  // Karyawan aktif yang belum memiliki akun login
  const unlinkedEmployees = employees.filter(
    (emp) =>
      emp.status === "AKTIF" &&
      !users.some(
        (u) =>
          (u.employeeId && u.employeeId === emp.id) ||
          u.username.toLowerCase() === emp.username.toLowerCase()
      )
  );

  // Role yang tersedia berdasarkan siapa yang login
  const isManager = currentUser?.role === "MANAGER";
  const ROLES = ALL_ROLES.filter((r) =>
    isManager ? MANAGER_ALLOWED_ROLES.includes(r.value) : true
  );

  // User yang bisa diedit: MANAGER hanya bisa edit user dengan role <= KASIR/LEADER
  const editableUsers = users.filter((u) =>
    isManager ? MANAGER_ALLOWED_ROLES.includes(u.role) : true
  );
  const getDeleteDisabledReason = (targetUser: User): string | null => {
    if (targetUser.id === currentUser?.id) {
      return "Tidak dapat menghapus akun Anda sendiri yang sedang aktif login.";
    }
    if (currentUser?.role === "OWNER") {
      return "Akun Owner hanya memiliki akses pantau (Read-only).";
    }
    if (isManager && !MANAGER_ALLOWED_ROLES.includes(targetUser.role)) {
      return `Manager tidak memiliki wewenang untuk menghapus akun role ${targetUser.role}.`;
    }
    return null;
  };

  const canDelete = (targetUser: User) => {
    return getDeleteDisabledReason(targetUser) === null;
  };

  const getEditDisabledReason = (targetUser: User): string | null => {
    if (currentUser?.role === "OWNER") {
      return "Akun Owner hanya memiliki akses pantau (Read-only).";
    }
    if (isManager && !MANAGER_ALLOWED_ROLES.includes(targetUser.role)) {
      return `Manager tidak memiliki wewenang untuk mengedit akun role ${targetUser.role}.`;
    }
    return null;
  };

  const canEdit = (targetUser: User) => {
    return getEditDisabledReason(targetUser) === null;
  };

  const handleSelectEmployee = (empId: string) => {
    setFormEmployeeId(empId);
    if (!empId) return;
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setFormName(emp.name);
      setFormUsername(emp.username || emp.name.toLowerCase().replace(/\s+/g, ""));
      if (!formPin) setFormPin("123456");

      const posUpper = (emp.position || "").toUpperCase();
      const deptUpper = (emp.department || "").toUpperCase();
      if (posUpper.includes("MANAGER") || posUpper.includes("MANAJER")) {
        setFormRole("MANAGER");
      } else if (posUpper.includes("LEADER")) {
        setFormRole("LEADER");
      } else if (posUpper.includes("KASIR")) {
        setFormRole("KASIR");
      } else if (deptUpper.includes("BAR") || posUpper.includes("BAR")) {
        setFormRole("BAR");
      } else if (
        deptUpper.includes("KITCHEN") ||
        deptUpper.includes("DAPUR") ||
        posUpper.includes("KITCHEN")
      ) {
        setFormRole("KITCHEN");
      } else if (deptUpper.includes("BAKER") || posUpper.includes("ROTI")) {
        setFormRole("BAKER");
      } else {
        setFormRole("KASIR");
      }
      if (emp.department) setFormDept(emp.department);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleanUsername = formUsername.trim().toLowerCase();
    const cleanName = formName.trim();
    const cleanPin = formPin.trim();

    if (!cleanUsername || !cleanName) {
      alert("Nama lengkap dan username tidak boleh kosong.");
      return;
    }
    if (!cleanPin || cleanPin.length < 4) {
      alert("PIN otorisasi minimal 4 digit angka.");
      return;
    }

    // Cari ID karyawan terkait (dari form atau pencocokan username)
    const targetEmpId =
      formEmployeeId ||
      employees.find(
        (emp) =>
          (editingUser?.employeeId && emp.id === editingUser.employeeId) ||
          emp.username.toLowerCase() === editingUser?.username.toLowerCase() ||
          emp.username.toLowerCase() === cleanUsername
      )?.id || null;

    const userData: any = {
      username: cleanUsername,
      pin: cleanPin,
      name: cleanName,
      role: formRole,
      employeeId: targetEmpId,
    };
    if (formRole === "LEADER") {
      userData.department = formDept;
    } else {
      userData.department = null;
    }

    if (editingUser) {
      updateUser({ ...userData, id: editingUser.id });
    } else {
      addUser(userData);
    }

    // Sinkronkan juga langsung ke data karyawan jika ada karyawan terkait
    if (targetEmpId) {
      const existingEmp = employees.find((emp) => emp.id === targetEmpId);
      if (existingEmp) {
        let pos = existingEmp.position;
        let dept = existingEmp.department;

        if (formRole === "KASIR") {
          pos = "Kasir";
        } else if (formRole === "MANAGER") {
          pos = "Manager";
        } else if (formRole === "LEADER") {
          pos = "Leader";
          if (userData.department) dept = userData.department;
        } else if (formRole === "BAR") {
          pos = "Karyawan";
          dept = "BAR";
        } else if (formRole === "KITCHEN") {
          pos = "Karyawan";
          dept = "KITCHEN";
        } else if (formRole === "BAKER") {
          pos = "Karyawan";
          dept = "BAKER";
        }

        updateEmployee({
          ...existingEmp,
          username: cleanUsername,
          name: cleanName,
          position: pos,
          department: dept,
        });
      }
    }

    setIsEditing(false);
    setEditingUser(null);
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormPin(user.pin || "");
    setFormRole(user.role);
    setFormDept(user.department || "BAR");
    const matchedEmp = employees.find(
      (e) =>
        (user.employeeId && e.id === user.employeeId) ||
        e.username.toLowerCase() === user.username.toLowerCase()
    );
    setFormEmployeeId(user.employeeId || matchedEmp?.id || "");
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setFormName("");
    setFormUsername("");
    setFormPin("123456");
    setFormRole("KASIR");
    setFormDept("BAR");
    setFormEmployeeId("");
    setIsEditing(true);
  };

  const handleCreateForEmployee = (emp: any) => {
    setEditingUser(null);
    handleSelectEmployee(emp.id);
    setIsEditing(true);
  };

  const handleDelete = (user: User) => {
    confirm.open({
      title: `Hapus Akun ${user.name}?`,
      message: `Akun login "${user.name}" (@${user.username}) dengan role ${user.role} akan dihapus secara permanen dari sistem login. Data absensi dan riwayat transaksi yang sudah ada akan tetap aman tersimpan.`,
      confirmLabel: "Ya, Hapus Pengguna",
      variant: "danger",
      onConfirm: () => deleteUser(user.id),
    });
  };

  const handleImportUsers = (data: any[]) => {
    let imported = 0;
    let updated = 0;
    data.forEach(row => {
      const idSistem = row["ID_SISTEM (JANGAN DIUBAH)"];
      const name = row["Nama Lengkap"] || row.name;
      const username = row["Username"] || row.username;
      const pin = row["PIN"] || row.pin;
      const role = row["Role"] || row.role;
      const department = row["Departemen"] || row.department;

      if (name && username && pin && role) {
        if (idSistem) {
          const existing = users.find(u => u.id === idSistem);
          if (existing) {
            updateUser({
              ...existing,
              name,
              username,
              pin: String(pin),
              role,
              department: role === "LEADER" ? department : null
            });
            updated++;
          }
        } else {
          addUser({ 
            name, 
            username, 
            pin: String(pin), 
            role, 
            department: role === "LEADER" ? department : null 
          });
          imported++;
        }
      }
    });
    if (imported > 0 || updated > 0) {
      alert(`Berhasil menambahkan ${imported} data baru dan memperbarui ${updated} pengguna.`);
    } else {
      alert("Tidak ada data valid yang diimport. Pastikan format kolom sesuai template.");
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto pb-12 w-full">
      <ConfirmModal {...confirm.modalProps} />
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Manajemen Pengguna
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Kelola akses role pengguna dalam sistem Julia's Management.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvImportExport
            onImport={handleImportUsers}
            templateHeaders={["Nama Lengkap", "Username", "PIN", "Role", "Departemen"]}
            templateExampleRow={["Budi Santoso", "budi", "123456", "KASIR", ""]}
            currentData={users.map(u => ({
              id: u.id,
              "Nama Lengkap": u.name,
              "Username": u.username,
              "PIN": u.pin,
              "Role": u.role,
              "Departemen": u.department || ""
            }))}
            templateFilename="template_pengguna"
            buttonLabel="Import Pengguna"
            templateDropdowns={{
              Role: isManager
                ? ["KASIR", "LEADER", "BAR", "KITCHEN", "BAKER"]
                : ["SUPER_ADMIN", "OWNER", "MANAGER", "FINANCE", "KASIR", "LEADER", "BAR", "KITCHEN", "BAKER"],
              Departemen: ["MAIN", "BAR", "KITCHEN"],
            }}
            templateHints={{
              PIN: "PIN 4–6 digit angka",
              Departemen: "Hanya diisi untuk role LEADER",
            }}
          />
          <button
            onClick={handleAddNew}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl flex items-center font-bold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
          >
            <Plus className="w-5 h-5 sm:mr-2" />
            <span className="hidden sm:inline">Tambah Pengguna</span>
          </button>
        </div>
      </div>

      {/* Banner Karyawan yang Belum Punya Akun */}
      {unlinkedEmployees.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5 md:mt-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-amber-900 text-sm">
                Terdapat {unlinkedEmployees.length} Karyawan Belum Memiliki Akun Login
              </h4>
              <p className="text-xs text-amber-700 mt-0.5">
                Data karyawan di modul SDM/HR belum tersinkronisasi dengan akun sistem. Anda dapat membuatkan akun dengan 1 klik.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {unlinkedEmployees.slice(0, 3).map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleCreateForEmployee(emp)}
                className="text-xs font-semibold px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Akun: {emp.name.split(" ")[0]} ({emp.position})
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Info banner untuk MANAGER */}
        {isManager && (
          <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 border-b border-blue-100 text-blue-700 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
            <span>
              <strong>Mode Manager:</strong> Anda hanya dapat mengelola akun dengan role <strong>Kasir, Leader, Bar, Kitchen, dan Baker</strong>.
            </span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-700 text-sm">Nama</th>
                <th className="p-4 font-bold text-slate-700 text-sm">
                  Username
                </th>
                <th className="p-4 font-bold text-slate-700 text-sm">
                  Peran / Role
                </th>
                <th className="p-4 font-bold text-slate-700 text-sm">
                  Tautan Data Karyawan (SDM)
                </th>
                <th className="p-4 font-bold text-slate-700 text-sm text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const linkedEmp = employees.find(
                  (e) =>
                    (user.employeeId && e.id === user.employeeId) ||
                    e.username.toLowerCase() === user.username.toLowerCase()
                );

                return (
                  <tr
                    key={user.id}
                    className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                      !canEdit(user) ? "opacity-50" : ""
                    }`}
                  >
                    <td className="p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mr-3 shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">
                          {user.name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">
                      {user.username}
                    </td>
                    <td className="p-4">
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          user.role === "SUPER_ADMIN" ? "bg-rose-100 text-rose-700" :
                          user.role === "OWNER"       ? "bg-purple-100 text-purple-700" :
                          user.role === "MANAGER"     ? "bg-blue-100 text-blue-700" :
                          user.role === "FINANCE"     ? "bg-emerald-100 text-emerald-700" :
                          user.role === "LEADER"      ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-700"
                        }`}>
                          {ALL_ROLES.find((r) => r.value === user.role)?.label || user.role}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {ALL_ROLES.find((r) => r.value === user.role)?.description}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      {linkedEmp ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60 w-fit">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{linkedEmp.name} ({linkedEmp.position})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60 w-fit">
                          <Link className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Akun Mandiri / Belum Ditautkan</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {canEdit(user) ? (
                        <button
                          onClick={() => startEdit(user)}
                          className="text-slate-400 hover:text-blue-600 p-2 transition-colors"
                          title="Edit pengguna"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      ) : (
                        <span
                          className="p-2 text-slate-200 inline-block cursor-not-allowed"
                          title={getEditDisabledReason(user) || "Tidak dapat mengedit role ini"}
                        >
                          <Edit className="w-4 h-4" />
                        </span>
                      )}
                      {canDelete(user) ? (
                        <button
                          onClick={() => handleDelete(user)}
                          className="text-slate-400 hover:text-rose-600 p-2 transition-colors ml-1"
                          title="Hapus pengguna"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span
                          className="p-2 text-slate-200 inline-block cursor-not-allowed ml-1"
                          title={getDeleteDisabledReason(user) || "Tidak dapat menghapus pengguna ini"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {isEditing && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl my-auto border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-blue-600 shrink-0" />
                {editingUser ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* Opsi Tautkan ke Data Karyawan */}
              <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
                <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600" />
                  Tautkan ke Data Karyawan (SDM)
                </label>
                <select
                  value={formEmployeeId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  className="w-full p-2.5 bg-white border border-blue-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-2xs"
                >
                  <option value="">-- Pilih Karyawan untuk Otomatisasi (Opsional) --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position}) - @{emp.username}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-blue-700/80 mt-1 leading-relaxed">
                  Memilih data karyawan akan otomatis mengisi nama, username, role, dan PIN sesuai profil SDM sehingga data absensi langsung tersambung.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Budi Santoso"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Username Login *
                  </label>
                  <input
                    type="text"
                    required
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="budikopi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    PIN Akses (4-6 Digit Angka) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-widest focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="123456"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Panjang: {formPin.length} digit (didukung 4 atau 6 digit)
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Peran (Role) *
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as Role)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {formRole === "LEADER" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Departemen / Bidang Kerja *
                  </label>
                  <select
                    value={formDept}
                    onChange={(e) => setFormDept(e.target.value as "BAR" | "KITCHEN" | "MAIN")}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
