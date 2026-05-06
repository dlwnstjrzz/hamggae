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
                console.log(`[DEBUG-EXEC-PARSE] row=${rowNumber} ${row.getCell(1).value || ''} ${String(name)} (${String(row.getCell(3).value || '')}) startDate=${startDate ? String(startDate) : null} endDate=${endDate ? String(endDate) : null}`);
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
          else if (header === '퇴사간주사유') {
              // PDF 경로: excel.js가 별도 컬럼에 사유를 씀 → 값이 있으면 퇴사간주
              if (cellValue && String(cellValue).trim()) {
                  emp['_inferredRetire'] = true;
                  emp['_inferredRetireReason'] = String(cellValue).trim();
                  console.log(`[DEBUG-PARSE] ${emp['성명'] || '?'}: 퇴사간주사유 읽음 = "${emp['_inferredRetireReason']}"`);
              }
          }
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

  // --- Masking Synchronization Logic ---
  // If ANY employee in ANY year is masked, mask ALL employees' IDs in ALL years.
  let hasAnyMaskedId = false;
  
  for (const result of results) {
      if (result.type === 'registry' && result.executives) {
          for (const exec of result.executives) {
              if (exec.id && String(exec.id).includes('*')) {
                  hasAnyMaskedId = true;
                  break;
              }
          }
      } else if (result.type === 'withholding' && result.employees) {
          for (const emp of result.employees) {
              if (emp['주민등록번호'] && String(emp['주민등록번호']).includes('*')) {
                  hasAnyMaskedId = true;
                  break;
              }
          }
      }
      if (hasAnyMaskedId) break;
  }

  if (hasAnyMaskedId) {
      console.log('[DEBUG] Masked ID found. Masking all IDs across all years.');
      const maskId = (idStr) => {
          if (!idStr) return idStr;
          const str = String(idStr).trim();
          if (str.includes('*')) return str; // Already masked
          
          if (str.includes('-')) {
              return `${str.split('-')[0]}-*******`; // YYMMDD-*******
          } else if (str.length >= 7) {
              return `${str.substring(0, 6)}*******`; // YYMMDD*******
          }
          return str; // Fallback
      };

      for (const result of results) {
          if (result.type === 'registry' && result.executives) {
              for (const exec of result.executives) {
                  exec.id = maskId(exec.id);
              }
          } else if (result.type === 'withholding' && result.employees) {
              for (const emp of result.employees) {
                  emp['주민등록번호'] = maskId(emp['주민등록번호']);
              }
          }
      }
  }

  // --- 퇴사간주 추론 로직 (PDF 경로의 generateExcel과 동일) ---
  const withholdingByYear = {};
  results.filter(r => r.type === 'withholding').forEach(r => {
      if (r.year) withholdingByYear[r.year] = r.employees;
  });

  const numericYears = Object.keys(withholdingByYear).map(Number).sort((a, b) => a - b);

  const getEmpKey = (emp) => {
      const jumin = String(emp['주민등록번호'] || '');
      const front = jumin.split('-')[0] || jumin.substring(0, 6);
      return `${emp['성명']}_${front}`;
  };

  const getLastDay = (year, month) => {
      const d = new Date(parseInt(year), parseInt(month), 0); // local time last day of month
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${dy}`;
  };

  const getSal = (emp, m) =>
      (emp.monthly_salary?.[m] || emp.monthly_salary?.[String(m)] || 0)
      + (emp.monthly_bonus?.[m] || emp.monthly_bonus?.[String(m)] || 0);

  const maxYear = numericYears.length > 0 ? numericYears[numericYears.length - 1] : null;

  const empKeysByYear = {};
  numericYears.forEach(y => {
      empKeysByYear[y] = new Set((withholdingByYear[String(y)] || []).map(getEmpKey));
  });

  numericYears.forEach(year => {
      (withholdingByYear[String(year)] || []).forEach(emp => {
          // 퇴사일이 이미 있으면 스킵 (실제 퇴사일 있거나 PDF 경로에서 orange cell로 이미 처리됨)
          if (emp['퇴사일']) return;

          let lastNonZeroMonth = null;
          for (let m = 12; m >= 1; m--) {
              if (getSal(emp, m) > 0) { lastNonZeroMonth = m; break; }
          }
          if (!lastNonZeroMonth) return;

          let inferredDate = null;
          let inferredReason = null;

          // Case 1: 마지막 급여월 이후 연속으로 전부 0 (최신 연도 포함 적용)
          if (lastNonZeroMonth < 12) {
              let allZeroAfter = true;
              for (let m = lastNonZeroMonth + 1; m <= 12; m++) {
                  if (getSal(emp, m) > 0) { allZeroAfter = false; break; }
              }
              if (allZeroAfter) {
                  inferredDate = getLastDay(year, lastNonZeroMonth);
                  inferredReason = '연중 급여 중단';
              }
          }

          // Case 2: 12월까지 급여 있으나 바로 다음 연도에 자료 없음
          // → 최신 연도는 미적용 (다음 연도 자료를 아직 안 넣은 것이므로 재직 중으로 판단)
          if (!inferredDate && lastNonZeroMonth === 12 && year !== maxYear) {
              const empKey = getEmpKey(emp);
              const nextYear = year + 1;
              const appearsNextYear = empKeysByYear[nextYear]?.has(empKey);
              if (!appearsNextYear) {
                  inferredDate = getLastDay(year, 12);
                  inferredReason = '다음연도 자료 없음';
              }
          }

          if (!inferredDate) return;

          // 퇴사일 없는 경우에만 여기 도달 (직접 Excel 업로드 경로)
          emp['퇴사일'] = inferredDate;
          emp['_inferredRetire'] = true;
          emp['_inferredRetireReason'] = inferredReason;
      });
  });

  console.log('[DEBUG] Final Results:', results);
  return results;
}
