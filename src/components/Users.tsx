import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { ShieldCheck, Plus, Trash2, Edit } from "lucide-react";
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
  const { users, employees, addUser, updateUser, deleteUser, currentUser, settings } =
    useStore();
  const { t } = useTranslation(settings.language || "id");
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const confirm = useConfirm();

  // Role yang tersedia berdasarkan siapa yang login
  const isManager = currentUser?.role === "MANAGER";
  const ROLES = ALL_ROLES.filter((r) =>
    isManager ? MANAGER_ALLOWED_ROLES.includes(r.value) : true
  );

  // User yang bisa diedit: MANAGER hanya bisa edit user dengan role <= KASIR/LEADER
  const editableUsers = users.filter((u) =>
    isManager ? MANAGER_ALLOWED_ROLES.includes(u.role) : true
  );
  // MANAGER tidak bisa hapus dirinya sendiri atau user role tinggi
  const canDelete = (targetUser: User) => {
    if (targetUser.id === currentUser?.id) return false;
    if (isManager && !MANAGER_ALLOWED_ROLES.includes(targetUser.role)) return false;
    return true;
  };
  const canEdit = (targetUser: User) => {
    if (isManager && !MANAGER_ALLOWED_ROLES.includes(targetUser.role)) return false;
    return true;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const role = formData.get("role") as Role;
    const userData: any = {
      username: formData.get("username") as string,
      pin: formData.get("pin") as string,
      name: formData.get("name") as string,
      role: role,
      employeeId: formData.get("employeeId") ? (formData.get("employeeId") as string) : null,
    };
    if (role === "LEADER") {
      userData.department = formData.get("department");
    } else {
      userData.department = null;
    }

    if (editingUser) {
      updateUser({ ...userData, id: editingUser.id });
    } else {
      addUser(userData);
    }
    setIsEditing(false);
    setEditingUser(null);
  };

  const [selectedRole, setSelectedRole] = useState<Role>("KASIR");

  const startEdit = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    // Default role: KASIR untuk semua, KASIR untuk Manager
    setSelectedRole("KASIR");
    setIsEditing(true);
  };

  const handleDelete = (user: User) => {
    confirm.open({
      title: `Hapus ${user.name}?`,
      message: `Akun "${user.name}" (${user.username}) akan dihapus secara permanen dan tidak dapat dikembalikan.`,
      confirmLabel: "Ya, Hapus",
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Info banner untuk MANAGER */}
        {isManager && (
          <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 border-b border-blue-100 text-blue-700 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
            <span>
              <strong>Mode Manager:</strong> Anda hanya dapat mengelola akun dengan role <strong>Kasir</strong> dan <strong>Leader</strong>.
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
                <th className="p-4 font-bold text-slate-700 text-sm text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${
                    !canEdit(user) ? "opacity-50" : ""
                  }`}
                >
                  <td className="p-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center mr-3">
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
                      <span className="p-2 text-slate-200 inline-block" title="Tidak dapat mengedit role ini">
                        <Edit className="w-4 h-4" />
                      </span>
                    )}
                    {canDelete(user) && (
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-slate-400 hover:text-rose-600 p-2 transition-colors ml-1"
                        title="Hapus pengguna"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60  flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-900 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
                {editingUser ? "Edit Pengguna" : "Tambah Pengguna"}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X_Icon className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  defaultValue={editingUser?.name}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Budi Santoso"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
                  required
                  defaultValue={editingUser?.username}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="kasir1"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  PIN (Password)
                </label>
                <input
                  type="text"
                  name="pin"
                  required
                  defaultValue={editingUser?.pin}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none tracking-widest"
                  placeholder="****"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Peran (Role)
                </label>
                <select
                  name="role"
                  required
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as Role)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedRole === "LEADER" && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">
                    Departemen / Lokasi
                  </label>
                  <select
                    name="department"
                    required
                    defaultValue={editingUser?.department || "BAR"}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">
                  Tautkan ke Data Karyawan (Opsional)
                </label>
                <select
                  name="employeeId"
                  defaultValue={editingUser?.employeeId || ""}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">-- Tidak ditautkan --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.position})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Berguna agar data absensi akun ini langsung masuk ke profil karyawan.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Dummy component for X icon, since we didn't import it at the top
const X_Icon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
