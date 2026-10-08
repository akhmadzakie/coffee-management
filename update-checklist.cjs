const fs = require('fs');
let code = fs.readFileSync('src/components/LeaderChecklist.tsx', 'utf8');

const bakerTasks = `
const LEADER_BAKER_TASKS = [
  "Pekerjaan Kebersihan (Area Pastry, Oven, dll)",
  "Pekerjaan Kontroling Alat (Mixer, Oven, Proofer, dll)",
  "Pekerjaan Gudang (Cek EXP ragi, tepung, butter, dll)",
  "Pekerjaan Kontroling Serving (Display Pastry)",
  "Pekerjaan Kontroling Karyawan (Asisten Baker)"
];
`;

code = code.replace(/const LEADER_KITCHEN_TASKS = \[([\s\S]*?)\];/, 'const LEADER_KITCHEN_TASKS = [$1];\n' + bakerTasks);

code = code.replace('const initialRole = currentUser?.role === "KITCHEN" ? "KITCHEN" : "BAR";', 'const initialRole = currentUser?.role === "KITCHEN" ? "KITCHEN" : currentUser?.role === "BAKER" ? "BAKER" : "BAR";');

code = code.replace('const [selectedRole, setSelectedRole] = useState<"BAR" | "KITCHEN">(initialRole);', 'const [selectedRole, setSelectedRole] = useState<"BAR" | "KITCHEN" | "BAKER">(initialRole);');

code = code.replace('const tasks = selectedRole === "BAR"', 'const tasks = selectedRole === "BAKER" ? (settings.leaderBakerTasks && settings.leaderBakerTasks.length > 0 ? settings.leaderBakerTasks : LEADER_BAKER_TASKS) : selectedRole === "BAR"');

code = code.replace('!currentUser || !["BAR", "KITCHEN"].includes(currentUser.role)', '!currentUser || !["BAR", "KITCHEN", "BAKER"].includes(currentUser.role)');

const buttonKitchen = `<button
            onClick={() => setSelectedRole("KITCHEN")}
            className={\`px-4 py-2 rounded-md text-sm font-medium transition-colors \${
              selectedRole === "KITCHEN"
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white"
            }\`}
          >
            Head Kitchen
            </button>`;

const buttonBaker = `<button
            onClick={() => setSelectedRole("BAKER")}
            className={\`px-4 py-2 rounded-md text-sm font-medium transition-colors \${
              selectedRole === "BAKER"
                ? "bg-amber-500 text-white"
                : "text-gray-400 hover:text-white"
            }\`}
          >
            Head Baker
          </button>`;

code = code.replace(buttonKitchen, buttonKitchen + '\n          ' + buttonBaker);

code = code.replace('Tugas Harian - {selectedRole === "BAR" ? "Bar" : "Kitchen"}', 'Tugas Harian - {selectedRole === "BAR" ? "Bar" : selectedRole === "KITCHEN" ? "Kitchen" : "Baker"}');
code = code.replace('Tugas harian khusus untuk Head Bar dan Head Kitchen.', 'Tugas harian khusus untuk Head Bar, Head Kitchen, dan Head Baker.');

fs.writeFileSync('src/components/LeaderChecklist.tsx', code);
console.log('LeaderChecklist.tsx updated!');
