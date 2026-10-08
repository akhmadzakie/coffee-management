const fs = require('fs');
let lines = fs.readFileSync('src/components/HRManagement.tsx', 'utf8').split('\n');
lines[1846] = lines[1846].replace('grid-cols-2', 'grid-cols-1');
lines.splice(1851, 4);
fs.writeFileSync('src/components/HRManagement.tsx', lines.join('\n'));
console.log('Fixed HRManagement.tsx');
