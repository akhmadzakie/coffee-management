import type {
  AttendanceRecord,
  DailyAttendance,
  Employee,
  User,
} from "../types";

export type ClassifiedAttendanceStatus =
  | "HADIR"
  | "TERLAMBAT"
  | "SAKIT"
  | "IZIN"
  | "ALPHA";

export interface AttendanceCorrectionFormInput {
  status: DailyAttendance["status"];
  clockInTime: string;
  clockOutTime: string;
  overtimeApproved: boolean;
  reason: string;
}

export interface MonthlyAttendanceRecapRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeePosition: string;
  period: string;
  onTimeDays: number;
  lateDays: number;
  presentDays: number;
  sickDays: number;
  permissionDays: number;
  alphaDays: number;
  totalWorkHours: number;
  approvedOvertimeHours: number;
  correctedCount: number;
  pendingCount: number;
  source: "DAILY" | "MANUAL";
  manualRecordId?: string;
}

/**
 * Memetakan ID mentah (bisa berupa `employee.id` atau `user.id`) ke `employee.id` kanonik
 * agar rekap absensi, payroll, dan export tidak terpecah menjadi dua baris.
 */
export function resolveCanonicalEmployeeId(
  rawEmployeeId: string,
  employees: Pick<Employee, "id" | "username">[] = [],
  users: Pick<User, "id" | "username" | "employeeId">[] = []
): string {
  if (!rawEmployeeId) return "";
  if (employees.some((e) => e.id === rawEmployeeId)) {
    return rawEmployeeId;
  }

  const matchedUser = users.find((u) => u.id === rawEmployeeId);
  if (matchedUser) {
    if (
      matchedUser.employeeId &&
      employees.some((e) => e.id === matchedUser.employeeId)
    ) {
      return matchedUser.employeeId;
    }
    const cleanUsername = (matchedUser.username || "").toLowerCase().trim();
    if (cleanUsername) {
      const matchedEmp = employees.find(
        (e) => (e.username || "").toLowerCase().trim() === cleanUsername
      );
      if (matchedEmp) return matchedEmp.id;
    }
  }

  return rawEmployeeId;
}

/**
 * Mengklasifikasikan status presensi harian secara seragam.
 * Catatan yang ditolak Manager (`approvalStatus === "REJECTED"`) selalu dianggap `ALPHA`.
 */
export function classifyDailyAttendanceStatus(
  att: Pick<DailyAttendance, "status" | "approvalStatus"> | {
    status?: string | null;
    approvalStatus?: string | null;
  }
): ClassifiedAttendanceStatus {
  const approval = String(att.approvalStatus || "").toUpperCase().trim();
  const status = String(att.status || "").toUpperCase().trim();

  if (approval === "REJECTED" || status === "ALPHA" || status === "DITOLAK") {
    return "ALPHA";
  }
  if (status === "HADIR" || status === "PRESENT" || status === "ON_TIME") {
    return "HADIR";
  }
  if (status === "TERLAMBAT" || status === "LATE") {
    return "TERLAMBAT";
  }
  if (status === "SAKIT") {
    return "SAKIT";
  }
  if (status === "IZIN") {
    return "IZIN";
  }
  return "ALPHA";
}

/**
 * Menghitung durasi jam kerja bersih (mendukung shift lintas tengah malam hingga 18 jam),
 * dibulatkan 1 angka di belakang koma.
 */
export function calculateWorkDurationHours(
  clockInTime?: string | null,
  clockOutTime?: string | null
): number {
  if (!clockInTime || !clockOutTime) return 0;
  const inMs = new Date(clockInTime).getTime();
  const outMs = new Date(clockOutTime).getTime();
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs)) return 0;

  let diffHours = (outMs - inMs) / 3600000;
  if (diffHours < 0 && diffHours + 24 > 0 && diffHours + 24 <= 18) {
    diffHours += 24;
  }
  if (diffHours <= 0 || diffHours >= 24) return 0;
  return Math.round(diffHours * 10) / 10;
}

/**
 * Membangun payload pembaruan `DailyAttendance` hasil koreksi Manager secara konsisten:
 * - Status non-hadir (`ALPHA`, `IZIN`, `SAKIT`) mengosongkan jam masuk/pulang & lembur.
 * - Mendukung shift lintas tengah malam (`clockOut < clockIn`).
 * - Membersihkan tag `[Terlambat ... menit]` ketika status dikoreksi menjadi selain `TERLAMBAT`.
 */
export function buildAttendanceCorrectionUpdate(
  existing: DailyAttendance,
  form: AttendanceCorrectionFormInput,
  managerName: string
): DailyAttendance {
  const isPresentStatus = form.status === "HADIR" || form.status === "TERLAMBAT";
  const dateStr = existing.date;
  let clockInIso: string | null = null;
  let clockOutIso: string | null = null;
  let overtimeHours = 0;
  let overtimeApproved = false;

  if (isPresentStatus) {
    const inDate = form.clockInTime
      ? new Date(`${dateStr}T${form.clockInTime}:00`)
      : null;
    const outDate = form.clockOutTime
      ? new Date(`${dateStr}T${form.clockOutTime}:00`)
      : null;

    const validIn = inDate && !Number.isNaN(inDate.getTime()) ? inDate : null;
    const validOut = outDate && !Number.isNaN(outDate.getTime()) ? outDate : null;

    if (validIn && validOut && validOut.getTime() < validIn.getTime()) {
      validOut.setDate(validOut.getDate() + 1);
    }

    clockInIso = validIn ? validIn.toISOString() : null;
    clockOutIso = validOut ? validOut.toISOString() : null;

    const workHours = calculateWorkDurationHours(clockInIso, clockOutIso);
    overtimeHours =
      workHours > 8 ? Math.round((workHours - 8) * 10) / 10 : 0;
    overtimeApproved = Boolean(form.overtimeApproved && overtimeHours > 0);
  }

  const trimmedReason = form.reason.trim();
  const rawSegments = String(existing.notes || "")
    .split(/\s*(?:•|\|)\s*/)
    .map((seg) => seg.trim())
    .filter(Boolean)
    .filter((seg) => !/^\[KOREKSI MANAGER\b/i.test(seg))
    .map((seg) =>
      form.status !== "TERLAMBAT"
        ? seg.replace(/\[?\s*Terlambat\s+\d+\s+menit\s*\]?/gi, "").trim()
        : seg
    )
    .filter(Boolean);

  rawSegments.push(`[KOREKSI MANAGER oleh ${managerName}]: ${trimmedReason}`);

  return {
    ...existing,
    status: form.status,
    clockInTime: clockInIso,
    clockOutTime: clockOutIso,
    overtimeHours,
    overtimeApproved,
    approvalStatus: "APPROVED",
    isCorrected: true,
    correctedBy: managerName,
    correctedAt: new Date().toISOString(),
    correctionReason: trimmedReason,
    notes: rawSegments.join(" • "),
  };
}

/**
 * Menghitung rekap absensi bulanan untuk satu periode `YYYY-MM` dengan menggabungkan
 * presensi harian (`dailyAttendances`) sebagai sumber utama dan rekap manual (`attendances`)
 * sebagai fallback bagi karyawan yang belum memiliki log harian di periode tersebut.
 */
export function computeMonthlyAttendanceRecap({
  period,
  dailyAttendances = [],
  manualAttendances = [],
  employees = [],
  users = [],
}: {
  period: string;
  dailyAttendances?: DailyAttendance[];
  manualAttendances?: AttendanceRecord[];
  employees?: Pick<Employee, "id" | "username" | "name" | "position">[];
  users?: Pick<User, "id" | "username" | "name" | "role" | "employeeId">[];
}): MonthlyAttendanceRecapRow[] {
  const cleanPeriod = String(period || "").trim();
  const logsByEmp = new Map<string, DailyAttendance[]>();

  for (const log of dailyAttendances) {
    if (cleanPeriod && !(log.date || "").startsWith(cleanPeriod)) continue;
    const canonId = resolveCanonicalEmployeeId(log.employeeId, employees, users);
    if (!canonId) continue;
    const list = logsByEmp.get(canonId);
    if (list) list.push(log);
    else logsByEmp.set(canonId, [log]);
  }

  const manualByEmp = new Map<string, AttendanceRecord>();
  for (const rec of manualAttendances) {
    if (cleanPeriod && rec.period !== cleanPeriod) continue;
    const canonId = resolveCanonicalEmployeeId(rec.employeeId, employees, users);
    if (!canonId) continue;
    manualByEmp.set(canonId, rec);
  }

  const allEmpIds = Array.from(
    new Set([...logsByEmp.keys(), ...manualByEmp.keys()])
  );

  const rows: MonthlyAttendanceRecapRow[] = [];

  for (const empId of allEmpIds) {
    const emp = employees.find((e) => e.id === empId);
    const user = !emp ? users.find((u) => u.id === empId) : undefined;
    const employeeName = emp?.name || user?.name || "Unknown";
    const employeePosition = emp?.position || user?.role || "-";
    const logs = logsByEmp.get(empId) || [];
    const manualRec = manualByEmp.get(empId);

    if (logs.length > 0) {
      let onTimeDays = 0;
      let lateDays = 0;
      let sickDays = 0;
      let permissionDays = 0;
      let alphaDays = 0;
      let totalWorkHoursRaw = 0;
      let approvedOvertimeRaw = 0;
      let correctedCount = 0;
      let pendingCount = 0;

      for (const l of logs) {
        const classified = classifyDailyAttendanceStatus(l);
        if (classified === "HADIR") onTimeDays++;
        else if (classified === "TERLAMBAT") lateDays++;
        else if (classified === "SAKIT") sickDays++;
        else if (classified === "IZIN") permissionDays++;
        else alphaDays++;

        if (classified === "HADIR" || classified === "TERLAMBAT") {
          const dur = calculateWorkDurationHours(l.clockInTime, l.clockOutTime);
          totalWorkHoursRaw += dur;
          if (l.overtimeApproved === true) {
            const ot =
              Number(l.overtimeHours) > 0
                ? Number(l.overtimeHours)
                : Math.max(0, Math.round((dur - 8) * 10) / 10);
            approvedOvertimeRaw += ot;
          }
        }

        if (l.isCorrected) correctedCount++;
        const rawAppStatus = String(l.approvalStatus || "PENDING").toUpperCase();
        const rawStatus = String(l.status || "").toUpperCase();
        if (rawAppStatus === "PENDING" && rawStatus !== "ALPHA") {
          pendingCount++;
        }
      }

      rows.push({
        id: `${empId}-${cleanPeriod || "ALL"}`,
        employeeId: empId,
        employeeName,
        employeePosition,
        period: cleanPeriod,
        onTimeDays,
        lateDays,
        presentDays: onTimeDays + lateDays,
        sickDays,
        permissionDays,
        alphaDays,
        totalWorkHours: Math.round(totalWorkHoursRaw * 10) / 10,
        approvedOvertimeHours: Math.round(approvedOvertimeRaw * 10) / 10,
        correctedCount,
        pendingCount,
        source: "DAILY",
      });
    } else if (manualRec) {
      rows.push({
        id: `${empId}-${manualRec.period}`,
        employeeId: empId,
        employeeName,
        employeePosition,
        period: manualRec.period,
        onTimeDays: Number(manualRec.presentDays) || 0,
        lateDays: 0,
        presentDays: Number(manualRec.presentDays) || 0,
        sickDays: Number(manualRec.sickDays) || 0,
        permissionDays: Number(manualRec.permissionDays) || 0,
        alphaDays: Number(manualRec.alphaDays) || 0,
        totalWorkHours: 0,
        approvedOvertimeHours: 0,
        correctedCount: 0,
        pendingCount: 0,
        source: "MANUAL",
        manualRecordId: manualRec.id,
      });
    }
  }

  return rows.sort((a, b) => a.employeeName.localeCompare(b.employeeName, "id"));
}

/**
 * Menyinkronkan rekaman rekap manual (`attendance_records`) yang terdampak ketika
 * `dailyAttendances` dikoreksi atau disahkan, sehingga data lama pada tabel `attendances`
 * tidak pernah tertinggal dari hasil koreksi harian.
 */
export function syncAttendanceRecordsWithDaily({
  dailyAttendances = [],
  existingAttendances = [],
  affectedPairs = [],
  employees = [],
  users = [],
}: {
  dailyAttendances?: DailyAttendance[];
  existingAttendances?: AttendanceRecord[];
  affectedPairs?: Array<{ employeeId: string; period: string }>;
  employees?: Pick<Employee, "id" | "username" | "name" | "position">[];
  users?: Pick<User, "id" | "username" | "name" | "role" | "employeeId">[];
}): { updatedAttendances: AttendanceRecord[]; changed: boolean } {
  if (existingAttendances.length === 0 || affectedPairs.length === 0) {
    return { updatedAttendances: existingAttendances, changed: false };
  }

  const affectedPeriods = new Set<string>();
  const affectedKeys = new Set<string>();

  for (const pair of affectedPairs) {
    const cleanPeriod = String(pair.period || "").slice(0, 7);
    if (cleanPeriod.length !== 7 || !pair.employeeId) continue;
    const canonId = resolveCanonicalEmployeeId(pair.employeeId, employees, users);
    if (!canonId) continue;
    affectedPeriods.add(cleanPeriod);
    affectedKeys.add(`${canonId}::${cleanPeriod}`);
  }

  if (affectedKeys.size === 0) {
    return { updatedAttendances: existingAttendances, changed: false };
  }

  const recapByPeriod = new Map<string, Map<string, MonthlyAttendanceRecapRow>>();
  for (const period of affectedPeriods) {
    const rows = computeMonthlyAttendanceRecap({
      period,
      dailyAttendances,
      manualAttendances: [],
      employees,
      users,
    });
    const map = new Map<string, MonthlyAttendanceRecapRow>();
    for (const r of rows) {
      if (r.source === "DAILY") {
        map.set(r.employeeId, r);
      }
    }
    recapByPeriod.set(period, map);
  }

  let changed = false;
  const updatedAttendances = existingAttendances.map((rec) => {
    const canonId = resolveCanonicalEmployeeId(rec.employeeId, employees, users);
    const key = `${canonId}::${rec.period}`;
    if (!affectedKeys.has(key)) return rec;

    const dailyRow = recapByPeriod.get(rec.period)?.get(canonId);
    if (!dailyRow) return rec;

    if (
      rec.presentDays === dailyRow.presentDays &&
      rec.sickDays === dailyRow.sickDays &&
      rec.permissionDays === dailyRow.permissionDays &&
      rec.alphaDays === dailyRow.alphaDays
    ) {
      return rec;
    }

    changed = true;
    return {
      ...rec,
      presentDays: dailyRow.presentDays,
      sickDays: dailyRow.sickDays,
      permissionDays: dailyRow.permissionDays,
      alphaDays: dailyRow.alphaDays,
    };
  });

  return { updatedAttendances, changed };
}
