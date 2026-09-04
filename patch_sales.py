import re

with open('src/components/Sales.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
import_statement = "import html2canvas from 'html2canvas';\nimport jsPDF from 'jspdf';\n"
content = content.replace("import { exportSalesToCSV, exportSalesToPDF } from '../utils/export';", import_statement + "import { exportSalesToCSV, exportSalesToPDF } from '../utils/export';")

# 2. Add handleDownloadPDF function inside the component
func_code = """
  const handlePrintPDF = () => {
    if (!currentInvoiceData) return;
    const client = clients.find(c => c.id === currentInvoiceData.clientId);
    const clientName = client ? client.coffeeShop : 'Client';
    const cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-');
    const fileName = `Invoice_${currentInvoiceData.invoiceNumber}_${cleanClientName}`;
    
    const originalTitle = document.title;
    document.title = fileName;
    window.print();
    document.title = originalTitle;
  };

  const handleDownloadPDF = async () => {
    if (!currentInvoiceData) return;
    
    const element = document.getElementById('invoice-print-area');
    if (!element) return;
    
    try {
      const client = clients.find(c => c.id === currentInvoiceData.clientId);
      const clientName = client ? client.coffeeShop : 'Client';
      const cleanClientName = clientName.replace(/[^a-zA-Z0-9]/g, '-');
      const fileName = `Invoice_${currentInvoiceData.invoiceNumber}_${cleanClientName}.pdf`;
      
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF', err);
    }
  };
"""
# find a good place to insert, right after `const handleExportPDF = () => { ... };`
insert_target = "  const handleExportPDF = () => {"
if insert_target in content:
    # Let's insert before handleExportPDF
    content = content.replace(insert_target, func_code + "\n" + insert_target)
else:
    # If not found, insert after exportSalesToPDF
    pass

# 3. Update the buttons in the modal
buttons_old = """              <div className="flex space-x-2">
                <button onClick={() => window.print()} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded flex items-center text-sm font-medium hover:bg-blue-100">
                  <Printer className="w-4 h-4 mr-1" /> {isIndo ? 'Cetak' : 'Print'}
                </button>
                <button onClick={() => setIsInvoiceModalOpen(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded text-sm font-medium">
                  {isIndo ? 'Tutup' : 'Close'}
                </button>
              </div>"""

buttons_new = """              <div className="flex space-x-2">
                <button onClick={handlePrintPDF} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded flex items-center text-sm font-medium hover:bg-blue-100">
                  <Printer className="w-4 h-4 mr-1" /> {isIndo ? 'Cetak' : 'Print'}
                </button>
                <button onClick={handleDownloadPDF} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded flex items-center text-sm font-medium hover:bg-emerald-100">
                  <Download className="w-4 h-4 mr-1" /> {isIndo ? 'Download PDF' : 'Download PDF'}
                </button>
                <button onClick={() => setIsInvoiceModalOpen(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-100 rounded text-sm font-medium">
                  {isIndo ? 'Tutup' : 'Close'}
                </button>
              </div>"""

content = content.replace(buttons_old, buttons_new)

with open('src/components/Sales.tsx', 'w') as f:
    f.write(content)
