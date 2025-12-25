
import * as XLSX from 'xlsx';

export const downloadExcel = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
        alert("No hay datos para exportar.");
        return;
    }

    // 1. Convert JSON to Worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);

    // 2. Create Workbook and append sheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos Exportados");

    // 3. Write file and trigger download
    XLSX.writeFile(workbook, `${filename}.xlsx`);
};
