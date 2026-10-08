const fs = require('fs');
let code = fs.readFileSync('src/components/HRManagement.tsx', 'utf8');

// Remove alphaDeductionPerDay state default
code = code.replace(/alphaDeductionPerDay:\s*\d+,/g, '');

// Remove alphaDeductionPerDay from import logic
code = code.replace(/alphaDeductionPerDay:\s*Number\(row\["Potongan Alpha\/Hari"\]\)\s*\|\|\s*0,/g, '');

// Remove from table headers
code = code.replace(/,\s*"Potongan Alpha\/Hari"/g, '');

// Remove from export headers
code = code.replace(/,\s*"Potongan Alpha\/Hari \(Rp\)"/g, '');

// Remove from data row mapping
code = code.replace(/,\s*"Potongan Alpha\/Hari \(Rp\)":\s*c\.alphaDeductionPerDay/g, '');

// Find and remove the "Potongan Alpha/Hari (Rp)" input field
const fieldRegex = /<div[^>]*>[\s\n]*<label[^>]*>Potongan Alpha\/Hari \(Rp\)<\/label>[\s\n]*<input[^>]*value=\{contractForm\.alphaDeductionPerDay\}[^>]*>[\s\n]*<\/div>/g;
code = code.replace(fieldRegex, '');

fs.writeFileSync('src/components/HRManagement.tsx', code);
console.log('Removed alphaDeductionPerDay from HRManagement.tsx');
