import fs from "node:fs";
import path from "node:path";

const COMPONENTS_DIR = path.join(process.cwd(), "src", "components");

function walkTsxFiles(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walkTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

const RULES = [
  {
    name: "NeutralForbidden",
    description: "Kelas netral terlarang (gray/stone/zinc/neutral; wajib slate-*)",
    regex: /\b(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|to|via|divide|shadow|fill|stroke)-(?:gray|stone|zinc|neutral)-(?:\d+(?:\/\d+)?)\b/,
  },
  {
    name: "AccentForbidden",
    description: "Kelas aksen lama (indigo/blue/yellow/red/green; wajib brand-* atau emerald/amber/rose/sky)",
    regex: /\b(?:[a-z0-9-]+:)*(?:bg|text|border|ring|from|to|via|divide|shadow|fill|stroke)-(?:indigo|blue|yellow|red|green)-(?:\d+(?:\/\d+)?)\b/,
  },
  {
    name: "NativeSelect",
    description: "Elemen <select> atau <optgroup> native (wajib CustomSelect)",
    regex: /<(?:select|optgroup)\b/,
  },
  {
    name: "NativeDateMonth",
    description: "Input tanggal/bulan native (wajib CustomDatePicker / CustomMonthPicker)",
    regex: /\btype=["'](?:date|month)["']/,
  },
  {
    name: "NativeAlertConfirm",
    description: "Dialog native window.alert()/confirm() (wajib Toast atau ConfirmModal)",
    regex: /\b(?:window\.)?(?:alert|confirm)\(/,
  },
  {
    name: "FramerMotion",
    description: "Import framer-motion terlarang (wajib motion/react)",
    regex: /["']framer-motion["']/,
  },
  {
    name: "CssAnimateConflict",
    description: "Kelas CSS animasi bentrok dengan motion/react (animate-in/fade-in/scale-up)",
    regex: /\b(?:animate-in|animate-fade-in|animate-scale-up)\b/,
  },
  {
    name: "HeaderSquishRisk",
    description: "Kontainer flex header dengan sm:flex-nowrap / md:flex-nowrap (berisiko menjepit judul)",
    regex: /\b(?:sm|md):flex-nowrap\b/,
  },
  {
    name: "UnresponsiveGrid",
    description: "Grid 4+ kolom tanpa breakpoint responsif (kecuali kalender & slip cetak)",
    excludeFiles: new Set(["CustomDatePicker.tsx", "PayslipModal.tsx"]),
    testLine(line) {
      const m = line.match(/(?<![\w:-])grid-cols-([4-9])\b/);
      if (!m) return false;
      // Izinkan jika baris sudah punya fallback/upgrade responsif (sm:/md:/lg:grid-cols-...)
      if (/\b(?:sm|md|lg|xl|2xl):grid-cols-\d+\b/.test(line)) return false;
      return true;
    },
  },
];

const files = walkTsxFiles(COMPONENTS_DIR);
let totalViolations = 0;

console.log(`=== JULIA'S UI & MOBILE HYGIENE AUDIT (${files.length} files) ===`);

for (const rule of RULES) {
  const hits = [];
  for (const file of files) {
    const baseName = path.basename(file);
    if (rule.excludeFiles && rule.excludeFiles.has(baseName)) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, idx) => {
      const matched = rule.testLine ? rule.testLine(line) : rule.regex.test(line);
      if (matched) {
        hits.push({
          file: path.relative(process.cwd(), file).replace(/\\/g, "/"),
          line: idx + 1,
          snippet: line.trim().slice(0, 120),
        });
      }
    });
  }

  const status = hits.length === 0 ? "PASS" : "FAIL";
  console.log(`[${status}] ${rule.name}: ${hits.length} hits (${rule.description})`);
  if (hits.length > 0) {
    totalViolations += hits.length;
    for (const h of hits.slice(0, 20)) {
      console.log(`       -> ${h.file}:${h.line}: ${h.snippet}`);
    }
    if (hits.length > 20) {
      console.log(`       ... +${hits.length - 20} hits lainnya`);
    }
  }
}

if (totalViolations > 0) {
  console.error(`\nUI AUDIT FAILED: ditemukan ${totalViolations} pelanggaran.`);
  process.exit(1);
}

console.log("\nUI AUDIT PASSED: 0 violations across all components.");
