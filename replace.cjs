const fs = require('fs');
let c = fs.readFileSync('src/components/ExpenseCategories.tsx', 'utf8');

c = c.replace(/text-emerald-400/g, 'text-emerald-600')
     .replace(/text-amber-400/g, 'text-amber-600')
     .replace(/text-emerald-300/g, 'text-emerald-600')
     .replace(/text-red-300/g, 'text-red-600')
     .replace(/text-amber-300/g, 'text-amber-600')
     .replace(/text-blue-300/g, 'text-blue-600')
     .replace(/text-violet-300/g, 'text-violet-600')
     .replace(/text-indigo-300/g, 'text-indigo-600')
     .replace(/text-gray-300/g, 'text-slate-600');

fs.writeFileSync('src/components/ExpenseCategories.tsx', c);
console.log('Fixed contrast colors');
