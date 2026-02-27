import ExcelJS from 'exceljs';

export async function parseExcel(file) {
  console.log('[DEBUG] Starting Excel Parse for:', file.name);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const results = [];

  workbook.eachSheet((worksheet, sheetId) => {
    const sheetName = worksheet.name;
    console.log(`[DEBUG] Processing Sheet: ${sheetName}`);
    
    // Check if sheet name matches year format
    const yearMatch = sheetName.match(/^(\d{4})$/);
    if (!yearMatch) {
        if (sheetName === '임원명단') {
            const executives = [];
            const headerRow = worksheet.getRow(1);
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // 헤더 제외
                const name = row.getCell(2).value;
                if (!name) return;
                
                let startDate = row.getCell(4).value;
                if (startDate instanceof Date) startDate = startDate.toISOString().split('T')[0];
                let endDate = row.getCell(5).value;
                if (endDate === '재직 중' || !endDate) endDate = null;
                else if (endDate instanceof Date) endDate = endDate.toISOString().split('T')[0];

                executives.push({
                    position: row.getCell(1).value,
                    name: String(name),
                    id: String(row.getCell(3).value || ''),
                    startDate: startDate ? String(startDate) : null,
                    endDate: endDate ? String(endDate) : null,
                    history: []
                });
            });
            results.push({
                type: 'registry',
                filename: '통합엑셀_임원정보',
                executives
            });
            console.log(`[DEBUG] Parsed ${executives.length} executives from '임원명단'`);
        } else {
            console.log(`[DEBUG] Skipping sheet "${sheetName}" (not a year or relevant sheet)`);
        }
        return;
    }

    const year = yearMatch[1];
    const employees = [];
    console.log(`[DEBUG] Year matched: ${year}`);

    // Assuming Row 1 is header
    const headerRow = worksheet.getRow(1);
    const headers = {};
    headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
    });
    console.log(`[DEBUG] Headers in ${sheetName}:`, headers);

    // Iterate rows starting from 2
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const emp = {
          'monthly_salary': {},
          'monthly_bonus': {}
      };

      row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (!header) return;

          // Handle merged cells or RichText values (ExcelJS might return object)
          let cellValue = cell.value;
          if (typeof cellValue === 'object' && cellValue !== null) {
              if (cellValue.richText) {
                  cellValue = cellValue.richText.map(t => t.text).join('');
              } else if (cellValue.text) {
                   cellValue = cellValue.text; // Some link objects
              }
              // Dates are objects too, but we handle them later
          }

          if (header === '성명') emp['성명'] = cellValue;
          else if (header === '주민등록번호') emp['주민등록번호'] = cellValue;
          else if (header === '입사일') emp['입사일'] = cell.value; // Keep raw for date check
          else if (header === '퇴사일') emp['퇴사일'] = cell.value; 
          else if (header === '총급여액') emp['총급여액'] = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue || 0);
          else if (header === '급여계') emp['급여계'] = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue || 0);
          else if (header === '상여계') emp['상여계'] = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue || 0);
          else {
              // Parse monthly
              const salaryMatch = header.match(/(\d+)월 급여/);
              if (salaryMatch) {
                  emp['monthly_salary'][salaryMatch[1]] = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue || 0);
              }
              const bonusMatch = header.match(/(\d+)월 상여/);
              if (bonusMatch) {
                  emp['monthly_bonus'][bonusMatch[1]] = typeof cellValue === 'number' ? cellValue : parseFloat(cellValue || 0);
              }
          }
      });

      // Basic validation
      if (emp['성명']) {
           // Helper to format date
           const formatDate = (val) => {
               if (val instanceof Date) {
                   // Add 9 hours to UTC to get KST approx if needed, or just use getFullYear/Month/Date
                   // ExcelJS dates are usually local or UTC. 
                   // Safest is toISOSString().split('T')[0] if it's correct.
                   // Actually, date.toLocaleDateString('en-CA') usually gives YYYY-MM-DD
                   const year = val.getFullYear();
                   const month = String(val.getMonth() + 1).padStart(2, '0');
                   const day = String(val.getDate()).padStart(2, '0');
                   return `${year}-${month}-${day}`;
               }
               return val; // Assume text or correctly formatted string
           };

           if (emp['입사일']) emp['입사일'] = formatDate(emp['입사일']);
           if (emp['퇴사일']) emp['퇴사일'] = formatDate(emp['퇴사일']); // Fix typo (was emp['주민등록번호'] logic?? no, previous code had weird fallback)

           if (emp['총급여액'] === undefined || isNaN(emp['총급여액'])) {
               emp['총급여액'] = (emp['급여계'] || 0) + (emp['상여계'] || 0);
           }
           
           employees.push(emp);
      }
    });
    
    console.log(`[DEBUG] Extracted ${employees.length} employees from ${sheetName}`);
    if(employees.length > 0) console.log('[DEBUG] First employee sample:', employees[0]);

    results.push({
        type: 'withholding',
        year: year,
        employees: employees
    });
  });

  console.log('[DEBUG] Final Results:', results);
  return results;
}
