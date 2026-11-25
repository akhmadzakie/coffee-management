import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/StoreContext";
import { ShieldCheck, Plus, Trash2, Edit, UserCheck, AlertCircle, X, Link } from "lucide-react";
import { Role, User } from "../types";
import { useTranslation } from "../utils/i18n";
import { CsvImportExport } from "./common/CsvImportExport";
import { ConfirmModal, useConfirm } from "./common/ConfirmModal";
import { CustomSelect } from "./common/CustomSelect";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "../context/ToastContext";

const ALL_ROLES: { value: string; label: string; description: string }[] = [
  { value: "SUPER_ADMIN", label: "Super Admin",       description: "Akses penuh semua sistem" },
  { value: "OWNER",       label: "Owner / Pemilik",   description: "Pantau data, tidak bisa edit" },
  { value: "MANAGER",     label: "Manager",           description: "Kelola operasional & keuangan" },
  { value: "FINANCE",     label: "Finance / Keuangan", description: "Akses modul keuangan" },
  { value: "KASIR",       label: "Kasir",             description: "Presensi & portal staf" },
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
  { value: "BAKER", label: "Bakery / Pastry" },
];

export const UsersComponent = () => {
  const { users, employees, addUser, updateUser, deleteUser, updateEmployee, currentUser, settings, unsuspendUser } =
    useStore();
  const { t } = useTranslation(settings.language || "id");
  const [isEditing, setIsEditing] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const confirm = useConfirm();

  const canUnsuspend =
    currentUser?.role === "MANAGER" || currentUser?.role === "SUPER_ADMIN";
  const suspendedUsers = users.filter((u) => Boolean(u.isSuspended));

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
  const isOwner = currentUser?.role === "OWNER";
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
      if (!editingUser && !formPin) setFormPin("123456");

      const posUpper = (emp.position || "").toUpperCase();
      const deptUpper = (emp.department || "").toUpperCase();
      let resolvedRole: Role = "KASIR";
      if (posUpper.includes("MANAGER") || posUpper.includes("MANAJER")) {
        resolvedRole = "MANAGER";
      } else if (posUpper.includes("FINANCE") || posUpper.includes("KEUANGAN") || posUpper.includes("AKUNTAN") || deptUpper.includes("FINANCE") || deptUpper.includes("KEUANGAN")) {
        resolvedRole = "FINANCE";
      } else if (posUpper.includes("LEADER")) {
        resolvedRole = "LEADER";
      } else if (posUpper.includes("KASIR")) {
        resolvedRole = "KASIR";
      } else if (deptUpper.includes("BAR") || posUpper.includes("BAR")) {
        resolvedRole = "BAR";
      } else if (
        deptUpper.includes("KITCHEN") ||
        deptUpper.includes("DAPUR") ||
        posUpper.includes("KITCHEN")
      ) {
        resolvedRole = "KITCHEN";
      } else if (deptUpper.includes("BAKER") || posUpper.includes("ROTI")) {
        resolvedRole = "BAKER";
      }
      if (isManager && !MANAGER_ALLOWED_ROLES.includes(resolvedRole)) {
        resolvedRole = "KASIR";
      }
      setFormRole(resolvedRole);
      if (emp.department) setFormDept(emp.department);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isOwner) {
      toast.warning("Akun Owner hanya memiliki akses pantau (Read-Only).");
      return;
    }
    if (isManager && !MANAGER_ALLOWED_ROLES.includes(formRole)) {
      toast.error(`Manager tidak dapat menetapkan role ${formRole}.`);
      return;
    }

    const cleanUsername = formUsername.trim().toLowerCase();
    const cleanName = formName.trim();
    const cleanPin = formPin.trim();

    if (!cleanUsername || !cleanName) {
      toast.error("Nama lengkap dan username tidak boleh kosong.");
      return;
    }

    const duplicateUser = users.find(
      (u) =>
        u.id !== editingUser?.id &&
        u.username.trim().toLowerCase() === cleanUsername
    );
    if (duplicateUser) {
      toast.error(`Username "@${cleanUsername}" sudah digunakan oleh ${duplicateUser.name}.`);
      return;
    }

    if (!editingUser && (!cleanPin || cleanPin.length < 4)) {
      toast.error("PIN otorisasi minimal 4 digit angka.");
      return;
    }
    if (editingUser && cleanPin.length > 0 && cleanPin.length < 4) {
      toast.error("Jika mengubah PIN, masukkan minimal 4 digit angka.");
      return;
    }

    // Cari ID karyawan terkait (dari form atau pencocokan username)
    const targetEmpId =
      formEmployeeId ||
      employees.find(
        (emp) =>
          (editingUser?.employeeId && emp.id === editingUser.employeeId) ||
          (editingUser?.username && emp.username.toLowerCase() === editingUser.username.toLowerCase()) ||
          emp.username.toLowerCase() === cleanUsername
      )?.id || null;

    const userData: any = {
      username: cleanUsername,
      pin: cleanPin || editingUser?.pin || "",
      name: cleanName,
      role: formRole,
      employeeId: targetEmpId,
      isSuspended: false,
      failedPinAttempts: 0,
      suspendedAt: null,
      suspendedReason: null,
    };
    if (formRole === "LEADER") {
      userData.department = formDept;
    } else {
      userData.department = null;
    }

    if (editingUser) {
      updateUser({ ...userData, id: editingUser.id });
      if (editingUser.isSuspended && canUnsuspend) {
        unsuspendUser(editingUser.id);
      }
      toast.success(`Akun "${cleanName}" berhasil diperbarui.`);
    } else {
      addUser(userData);
      toast.success(`Akun baru "${cleanName}" (@${cleanUsername}) berhasil ditambahkan.`);
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
        } else if (formRole === "FINANCE") {
          pos = "Finance";
          if (!dept || dept === "BAR") dept = "FINANCE";
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
    if (isOwner) return;
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
    if (isOwner) return;
    setEditingUser(null);
    handleSelectEmployee(emp.id);
    setIsEditing(true);
  };

  const handleUnsuspend = async (user: User) => {
    const ok = await unsuspendUser(user.id);
    if (ok) {
      toast.success(`Suspend akun "${user.name}" (@${user.username}) berhasil dibuka.`);
    } else {
      toast.error(`Gagal membuka suspend akun "${user.name}".`);
    }
  };

  const handleDelete = (user: User) => {
    confirm.open({
      title: `Hapus Akun ${user.name}?`,
      message: `Akun login "${user.name}" (@${user.username}) dengan role ${user.role} akan dihapus secara permanen dari sistem login. Data absensi dan riwayat transaksi yang sudah ada akan tetap aman tersimpan.`,
      confirmLabel: "Ya, Hapus Pengguna",
      variant: "danger",
      onConfirm: () => {
        deleteUser(user.id);
        toast.success(`Akun "${user.name}" telah dihapus.`);
      },
    });
  };

  const handleImportUsers = (data: any[]) => {
    if (isOwner) {
      toast.warning("Akun Owner tidak diizinkan mengimpor pengguna.");
      return;
    }
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const seenUsernames = new Set(users.map((u) => u.username.toLowerCase()));

    data.forEach((row) => {
      const idSistem = row["ID_SISTEM (JANGAN DIUBAH)"];
      const name = String(row["Nama Lengkap"] || row.name || "").trim();
      const username = String(row["Username"] || row.username || "").trim().toLowerCase();
      const rawPin = row["PIN"] !== undefined && row["PIN"] !== null ? String(row["PIN"]).trim() : "";
      const role = String(row["Role"] || row.role || "").trim().toUpperCase() as Role;
      const department = row["Departemen"] || row.department;

      if (!name || !username || !role) return;
      if (isManager && !MANAGER_ALLOWED_ROLES.includes(role)) {
        skipped++;
        return;
      }

      if (idSistem) {
        const existing = users.find((u) => u.id === idSistem);
        if (existing) {
          if (isManager && !MANAGER_ALLOWED_ROLES.includes(existing.role)) {
            skipped++;
            return;
          }
          if (rawPin && rawPin.length < 4) {
            skipped++;
            return;
          }
          updateUser({
            ...existing,
            name,
            username,
            pin: rawPin || existing.pin || "",
            role,
            department: (role === "LEADER" ? department || existing.department || "BAR" : null) as any,
          });
          updated++;
        }
      } else {
        if (!rawPin || rawPin.length < 4 || seenUsernames.has(username)) {
          skipped++;
          return;
        }
        seenUsernames.add(username);
        addUser({
          name,
          username,
          pin: rawPin,
          role,
          department: (role === "LEADER" ? department || "BAR" : null) as any,
        });
        imported++;
      }
    });
    if (imported > 0 || updated > 0) {
      toast.success(
        `Berhasil menambahkan ${imported} pengguna baru dan memperbarui ${updated} pengguna.${skipped > 0 ? ` (${skipped} baris dilewati)` : ""}`
      );
    } else {
      toast.warning("Tidak ada data valid yang diimpor. Pastikan kolom Nama, Username, PIN, & Role sesuai template.");
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-7xl mx-auto pb-12 w-full">
      <ConfirmModal {...confirm.modalProps} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Manajemen Pengguna
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Kelola akses role pengguna dalam sistem Julia's Management.
          </p>
        </div>
        {!isOwner && (
        <div className="flex items-center gap-2.5 shrink-0 flex-nowrap">
          <CsvImportExport
            onImport={handleImportUsers}
            templateHeaders={["Nama Lengkap", "Username", "PIN", "Role", "Departemen"]}
            templateExampleRow={["Budi Santoso", "budi", "123456", "KASIR", ""]}
            currentData={editableUsers.map(u => ({
              id: u.id,
              "Nama Lengkap": u.name,
              "Username": u.username,
              "PIN": "",
              "Role": u.role,
              "Departemen": u.department || ""
            }))}
            templateFilename="template_pengguna"
            buttonLabel="Import Pengguna"
            templateDropdowns={{
              Role: isManager
                ? ["KASIR", "LEADER", "BAR", "KITCHEN", "BAKER"]
                : ["SUPER_ADMIN", "OWNER", "MANAGER", "FINANCE", "KASIR", "LEADER", "BAR", "KITCHEN", "BAKER"],
              Departemen: ["MAIN", "BAR", "KITCHEN", "BAKER"],
            }}
            templateHints={{
              PIN: "PIN 4–6 digit angka (kosongkan saat edit jika tetap)",
              Departemen: "Hanya diisi untuk role LEADER",
            }}
          />
          <button
            onClick={handleAddNew}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl flex items-center font-bold transition-colors shadow-xs shrink-0 whitespace-nowrap cursor-pointer active:scale-95 text-xs"
          >
            <Plus className="w-4 h-4 mr-1.5 shrink-0" />
            <span>Tambah Pengguna</span>
          </button>
        </div>
        )}
      </div>

      {/* Banner Akun Ter-suspend (Salah PIN 3x) */}
      {suspendedUsers.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0 mt-0.5 md:mt-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-rose-900 text-sm">
                🚨 {suspendedUsers.length} Akun Ter-suspend Otomatis (Salah Memasukkan PIN 3x)
              </h4>
              <p className="text-xs text-rose-700 mt-0.5">
                Akun yang ter-suspend tidak dapat login sampai dibuka kembali (Unsuspend) oleh Manager atau Super Admin.
              </p>
            </div>
          </div>
          {canUnsuspend && (
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {suspendedUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleUnsuspend(u)}
                  className="text-xs font-bold px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>🔓 Buka Suspend: {u.name} (@{u.username})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
          {!isOwner && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {unlinkedEmployees.slice(0, 3).map((emp) => (
              <button
                key={emp.id}
                onClick={() => handleCreateForEmployee(emp)}
                className="text-xs font-semibold px-3 py-1.5 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Akun: {emp.name.split(" ")[0]} ({emp.position})
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Info banner untuk MANAGER */}
        {isManager && (
          <div className="flex items-center gap-2 px-5 py-3 bg-brand-50 border-b border-brand-100 text-brand-700 text-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-brand-500" />
            <span>
              <strong>Mode Manager:</strong> Anda hanya dapat mengelola akun dengan role <strong>Kasir, Leader, Bar, Kitchen, dan Baker</strong>.
            </span>
          </div>
        )}
        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
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
                        <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center mr-3 shrink-0 border ${
                          user.isSuspended
                            ? "bg-rose-600 text-white border-rose-600"
                            : "bg-brand-50 text-brand-700 border-brand-200/80"
                        }`}>
                          {user.isSuspended ? "🔒" : user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900">
                              {user.name}
                            </span>
                            {user.isSuspended && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                                🔒 Ter-suspend (Salah PIN 3x)
                              </span>
                            )}
                            {!user.isSuspended && Number(user.failedPinAttempts || 0) > 0 && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                ⚠️ Gagal PIN {user.failedPinAttempts}/3
                              </span>
                            )}
                          </div>
                          {user.isSuspended && user.suspendedReason && (
                            <p className="text-[11px] text-rose-600 mt-0.5">
                              {user.suspendedReason}
                            </p>
                          )}
                        </div>
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
                          user.role === "MANAGER"     ? "bg-brand-100 text-brand-700" :
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
                      <div className="inline-flex items-center justify-end gap-1">
                        {user.isSuspended && canUnsuspend && (
                          <button
                            type="button"
                            onClick={() => handleUnsuspend(user)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors mr-1 cursor-pointer shadow-2xs"
                            title="Buka Suspend Akun (Unsuspend)"
                          >
                            🔓 Buka Suspend
                          </button>
                        )}
                        {canEdit(user) ? (
                          <button
                            onClick={() => startEdit(user)}
                            className="text-slate-400 hover:text-brand-600 p-2 transition-colors cursor-pointer"
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
                            className="text-slate-400 hover:text-rose-600 p-2 transition-colors ml-1 cursor-pointer"
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
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card Feed */}
        <div className="block md:hidden divide-y divide-slate-100 p-3 sm:p-4 space-y-3">
          {users.map((user) => {
            const linkedEmp = employees.find(
              (e) =>
                (user.employeeId && e.id === user.employeeId) ||
                e.username.toLowerCase() === user.username.toLowerCase()
            );

            return (
              <div
                key={user.id}
                className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3 ${
                  !canEdit(user) ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl font-bold flex items-center justify-center text-sm border shrink-0 ${
                      user.isSuspended
                        ? "bg-rose-600 text-white border-rose-600"
                        : "bg-brand-50 text-brand-700 border-brand-200/80"
                    }`}>
                      {user.isSuspended ? "🔒" : user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{user.name}</h4>
                        {user.isSuspended && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
                            Ter-suspend
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono">@{user.username}</p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                    user.role === "SUPER_ADMIN" ? "bg-rose-100 text-rose-700" :
                    user.role === "OWNER"       ? "bg-purple-100 text-purple-700" :
                    user.role === "MANAGER"     ? "bg-brand-100 text-brand-700" :
                    user.role === "FINANCE"     ? "bg-emerald-100 text-emerald-700" :
                    user.role === "LEADER"      ? "bg-amber-100 text-amber-700" :
                    "bg-slate-100 text-slate-700"
                  }`}>
                    {ALL_ROLES.find((r) => r.value === user.role)?.label || user.role}
                  </span>
                </div>

                <div>
                  {linkedEmp ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200/60">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Tersambung: {linkedEmp.name} ({linkedEmp.position})</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/60">
                      <Link className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Akun Mandiri / Belum Ditautkan</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  {user.isSuspended && canUnsuspend && (
                    <button
                      type="button"
                      onClick={() => handleUnsuspend(user)}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <span>🔓 Buka Suspend</span>
                    </button>
                  )}
                  {canEdit(user) && (
                    <button
                      onClick={() => startEdit(user)}
                      className="px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors flex items-center gap-1 border border-brand-200/60 cursor-pointer active:scale-95"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                  {canDelete(user) && (
                    <button
                      onClick={() => handleDelete(user)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center gap-1 border border-rose-200/60 cursor-pointer active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isEditing && (
              <motion.div
                key="users-edit-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex justify-center items-start sm:items-center z-50 p-3 sm:p-6 overflow-y-auto"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ type: "spring", damping: 28, stiffness: 360 }}
                  className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl my-auto border border-slate-200/80 flex flex-col max-h-[85vh] sm:max-h-[88vh]"
                >
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 shrink-0">
              <h3 className="font-bold text-base sm:text-lg text-slate-900 flex items-center">
                <ShieldCheck className="w-5 h-5 mr-2 text-brand-600 shrink-0" />
                {editingUser ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
              {/* Opsi Tautkan ke Data Karyawan */}
              <div className="p-3 bg-brand-50/60 border border-brand-100 rounded-2xl">
                <label className="block text-xs font-bold text-brand-900 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-brand-600" />
                  Tautkan ke Data Karyawan (SDM)
                </label>
                <CustomSelect
                  value={formEmployeeId}
                  onChange={handleSelectEmployee}
                  placeholder="-- Pilih Karyawan untuk Otomatisasi (Opsional) --"
                  options={[
                    { value: "", label: "-- Pilih Karyawan untuk Otomatisasi (Opsional) --" },
                    ...employees.map((emp) => ({
                      value: emp.id,
                      label: `${emp.name} (${emp.position}) - @${emp.username}`,
                    })),
                  ]}
                  buttonClassName="w-full p-2.5 bg-white border border-brand-200 rounded-xl text-base sm:text-xs font-medium text-slate-800 shadow-2xs"
                />
                <p className="text-[11px] text-brand-700/80 mt-1 leading-relaxed">
                  Memilih data karyawan akan otomatis mengisi nama, username, role, dan PIN sesuai profil SDM sehingga data absensi langsung tersambung.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
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
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs focus:ring-2 focus:ring-brand-500/20 outline-none"
                    placeholder="budikopi"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    {editingUser ? "PIN Akses Baru (Opsional)" : "PIN Akses (4-6 Digit Angka) *"}
                  </label>
                  <input
                    type="text"
                    required={!editingUser}
                    maxLength={6}
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-mono tracking-widest focus:ring-2 focus:ring-brand-500/20 outline-none"
                    placeholder={editingUser ? "Kosongkan jika PIN tetap" : "123456"}
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {editingUser && formPin.length === 0
                      ? "PIN lama tetap dipertahankan jika dikosongkan"
                      : `Panjang: ${formPin.length} digit (didukung 4 atau 6 digit)`}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Peran (Role) *
                  </label>
                  <CustomSelect
                    value={formRole}
                    onChange={(val) => setFormRole(val as Role)}
                    options={ROLES.map((r) => ({
                      value: r.value,
                      label: r.label,
                    }))}
                    buttonClassName="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-medium hover:bg-white"
                  />
                </div>
              </div>

              {formRole === "LEADER" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Departemen / Bidang Kerja *
                  </label>
                  <CustomSelect
                    value={formDept}
                    onChange={(val) => setFormDept(val as "BAR" | "KITCHEN" | "MAIN" | "BAKER")}
                    options={DEPARTMENTS.map((d) => ({
                      value: d.value,
                      label: d.label,
                    }))}
                    buttonClassName="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-medium hover:bg-white"
                  />
                </div>
              )}
              </div>

              <div className="flex gap-3 p-4 sm:p-5 border-t border-slate-100 bg-slate-50/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-brand-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-brand-700 transition-colors shadow-xs cursor-pointer active:scale-95"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};
