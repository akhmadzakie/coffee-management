const fs = require('fs');
let code = fs.readFileSync('src/components/HRManagement.tsx', 'utf8');
code = code.replace(/Pastikan NIK karyawan sesuai/g, 'Pastikan Username karyawan sesuai');
code = code.replace(/templateHeaders=\{\["NIK"/g, 'templateHeaders={["Username"');
code = code.replace(/<th className="py-3 px-4 font-semibold">NIK<\/th>/g, '<th className="py-3 px-4 font-semibold">Username</th>');
code = code.replace(/selectedPayslip\.employee\.nik/g, 'selectedPayslip.employee.username');
fs.writeFileSync('src/components/HRManagement.tsx', code);
console.log('Replaced NIK with Username in HRManagement.tsx');
