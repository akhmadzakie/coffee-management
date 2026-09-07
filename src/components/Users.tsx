import React, { useState } from "react";
import { useStore } from "../store/StoreContext";
import { ShieldCheck, Plus, Trash2, Edit } from "lucide-react";
import { Role, User } from "../types";
import { useTranslation } from "../utils/i18n";
import { CsvImportExport } from "./common/CsvImportExport";

const ROLES: { value: Role; label: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "OWNER", label: "Owner / Pemilik" },
  { value: "MANAGER", label: "Manager" },
  { value: "FINANCE", label: "Finance / Keuangan" },
  { value: "KASIR", label: "Kasir" },
];

export const UsersComponent = () => {
  const { users, addUser, updateUser, deleteUser, currentUser, settings } =
    useStore();
  const { t } = useTranslation(settings.language || "id");
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const userData = {
      username: formData.get("username") as string,
      pin: formData.get("pin") as string,
      name: formData.get("name") as string,
      role: formData.get("role") as Role,
    };

    if (editingUser) {
      updateUser({ ...userData, id: editingUser.id });
    } else {
      addUser(userData);
    }
    setIsEditing(false);
    setEditingUser(null);
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    setIsEditing(true);
  };

  const handleAddNew = () => {
    setEditingUser(null);
    setIsEditing(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Apakah Anda yakin ingin menghapus pengguna ini?")) {
      deleteUser(id);
    }
  };

  const handleImportUsers = (data: any[]) => {
    let imported = 0;
    data.forEach(row => {
      const name = row["Nama Lengkap"] || row.name;
      const username = row["Username"] || row.username;
      const pin = row["PIN"] || row.pin;
      const role = row["Role"] || row.role;

      if (name && username && pin && role) {
        addUser({ name, username, pin: String(pin), role });
        imported++;
      }
    });
    if (imported > 0) {
      alert(`Berhasil mengimport ${imported} pengguna.`);
    } else {
      alert("Tidak ada data valid yang diimport. Pastikan format kolom sesuai template.");
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto pb-12 w-full">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Manajemen Pengguna
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Kelola akses role pengguna dalam sistem Kedai Kopi Manager.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvImportExport
            onImport={handleImportUsers}
            templateHeaders={["Nama Lengkap", "Username", "PIN", "Role"]}
            templateExampleRow={["Budi Santoso", "budi123", "1234", "KASIR"]}
            templateFilename="template_pengguna"
            buttonLabel="Import User"
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
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
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
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                      {ROLES.find((r) => r.value === user.role)?.label ||
                        user.role}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => startEdit(user)}
                      className="text-slate-400 hover:text-blue-600 p-2 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {currentUser?.id !== user.id && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-slate-400 hover:text-rose-600 p-2 transition-colors ml-1"
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
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
                  defaultValue={editingUser?.role || "KASIR"}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
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
