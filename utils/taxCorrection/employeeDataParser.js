import ExcelJS from 'exceljs';

export async function parseEmployeeData(file) {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const allYearsData = [];

  // Iterate over all worksheets
  workbook.eachSheet((worksheet, sheetId) => {
    const sheetName = worksheet.name;
    // Check if sheet name is a year (e.g., "2023", "2024")
    if (/^\d{4}$/.test(sheetName)) {
      console.log(`Processing sheet: ${sheetName}`);
      const year = parseInt(sheetName);
      const sheetData = processSheet(worksheet, year);
      allYearsData.push(...sheetData);
    }
  });

  // Sort by year and name
  allYearsData.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.name.localeCompare(b.name);
  });

  return allYearsData;
}

function processSheet(worksheet, year) {
  const data = [];
  const headers = {};
  
  // Header parsing (Row 1 expected)
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = cell.value;
  });

  // Determine column indices
  let colIndices = {
    name: -1,
    id: -1,
    hireDate: -1,
    retireDate: -1,
    salaryStart: -1 // 1월 급여 시작 위치
  };

  // Find columns based on header text
  for (const [col, value] of Object.entries(headers)) {
      const strVal = String(value).trim();
      if (strVal === '성명') colIndices.name = parseInt(col);
      else if (strVal.includes('주민등록번호')) colIndices.id = parseInt(col);
      else if (strVal === '입사일') colIndices.hireDate = parseInt(col);
      else if (strVal === '퇴사일') colIndices.retireDate = parseInt(col);
      else if (strVal === '1월 급여') colIndices.salaryStart = parseInt(col);
  }

  if (colIndices.name === -1 || colIndices.salaryStart === -1) {
      console.warn(`Sheet ${year} missing critical columns.`);
      return [];
  }

  // Rows iterate
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const name = row.getCell(colIndices.name).value;
    if (!name) return;

    const id = row.getCell(colIndices.id).value || '';
    const hireDate = row.getCell(colIndices.hireDate).value;
    const retireDate = row.getCell(colIndices.retireDate).value;

    // Extract raw values for logic
    const rawHire = normalizeDate(hireDate);
    const rawRetire = normalizeDate(retireDate);
    const rawId = String(id).trim();

    // Analyze monthly data
    const result = analyzeYouthStatus(name, rawId, rawHire, rawRetire, row, colIndices.salaryStart, year);
    
    data.push(result);
  });

  return data;
}

function normalizeDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().split('T')[0];
    return String(val).trim();
}

function analyzeYouthStatus(name, id, hireDate, retireDate, row, salaryStartCol, year) {
  let youthMonths = 0;
  let normalMonths = 0;
  let youthSalary = 0;
  let normalSalary = 0;
  let totalSalary = 0;

  // New fields for Social Insurance
  let socialInsuranceTotalSalary = 0;
  let socialInsuranceYouthSalary = 0;
  let socialInsuranceNormalSalary = 0;
  let socialInsuranceExcludedSalary = 0;
  let resignationExcludedMonth = null;

  // Birthday from ID
  // ID format: 123456-1****** or 1234561234567
  let birthDate = null;
  if (id && id.length >= 6) {
      const front = id.substring(0, 6); // YYMMDD
      const yy = parseInt(front.substring(0, 2));
      
      // 주민번호 뒷자리 무시 (사용자 요청)
      // YY 기준: 00~29 -> 2000년대, 30~99 -> 1900년대
      let birthYearPrefix = (yy < 30) ? '20' : '19';

      const y = parseInt(birthYearPrefix + front.substring(0, 2));
      const m = parseInt(front.substring(2, 4)) - 1; // 0-indexed
      const d = parseInt(front.substring(4, 6));
      birthDate = new Date(y, m, d);
  }

  // Parse dates once if possible, but keep existing logic flow for consistency
  const hDate = hireDate ? new Date(hireDate) : null;
  const rDate = retireDate ? new Date(retireDate) : null;

  for (let m = 1; m <= 12; m++) {
      const monthEnd = new Date(year, m, 0); // Last day of month m
      
      const salaryCol = salaryStartCol + (m - 1);
      const bonusCol = salaryStartCol + 12 + (m - 1); // Assuming bonus follows 12 months of salary

      let salary = 0;
      const salVal = row.getCell(salaryCol).value;
      const bonVal = row.getCell(bonusCol).value;
      
      // ExcelJS value handling
      if (typeof salVal === 'number') salary += salVal;
      if (typeof bonVal === 'number') salary += bonVal;

      totalSalary += salary;

      // Age Calculation at month end
      let isYouth = false;
      let age = -1;
      
      if (birthDate) {
          age = calculateManAge(birthDate, monthEnd);
          if (age <= 29) isYouth = true;
      }

      // Employment Status at Month End
      let isEmployedAtMonthEnd = false;

      if (hDate && hDate <= monthEnd) {
          if (!rDate || rDate >= monthEnd) {
              isEmployedAtMonthEnd = true;
          }
      }

      // Aggregate
      if (isEmployedAtMonthEnd) {
          if (isYouth) youthMonths++;
          else normalMonths++;
      }

      if (salary > 0) {
          if (isYouth) youthSalary += salary;
          else normalSalary += salary;

          // Social Insurance Logic: Exclude salary if it is the resignation month
          // Rule: If an employee resigns in the middle of the month (e.g. 7/8), 
          // that month (7) should be excluded from the social insurance salary calculation.
          // Note: Income Tax Total Salary still includes this amount.
          let isResignationMonth = false;
          if (rDate && rDate.getFullYear() === year && rDate.getMonth() + 1 === m) {
              isResignationMonth = true;
          }

          if (!isResignationMonth) {
              if (isYouth) socialInsuranceYouthSalary += salary;
              else socialInsuranceNormalSalary += salary;
              socialInsuranceTotalSalary += salary;
          } else {
              // Track excluded salary for display
              socialInsuranceExcludedSalary += salary;
              resignationExcludedMonth = m; 
          }
      }
  }

  // Age at Year End (Display purpose)
  let ageYearEnd = '';
  if (birthDate) {
      ageYearEnd = calculateManAge(birthDate, new Date(year, 12, 0));
  }

  return {
      year,
      name,
      id,
      hireDate,
      retireDate,
      ageYearEnd,
      totalSalary,
      youthMonths,
      normalMonths,
      youthSalary,
      normalSalary,
      socialInsuranceTotalSalary,
      socialInsuranceYouthSalary,
      socialInsuranceNormalSalary,
      socialInsuranceExcludedSalary,
      resignationExcludedMonth,
      isYouth: youthMonths > 0 // Add this for frontend filtering/styling
  };
}


// New Adapter for JSON input (from excelParser.js)
export function analyzeEmployee(empObj, year) {
    const name = empObj['성명'];
    const id = empObj['주민등록번호'] || '';
    const hireDate = empObj['입사일'] ? new Date(empObj['입사일']) : null;
    const retireDate = empObj['퇴사일'] ? new Date(empObj['퇴사일']) : null;
    
    // Re-use logic or duplicate for JSON structure?
    // Since the original logic relies on row/col parsing, it's easier to duplicate the core logic adapted for JSON
    
    return calculateEmployeeTaxStatus(name, id, hireDate, retireDate, empObj, year);
}

function calculateEmployeeTaxStatus(name, id, hireDate, retireDate, empObj, year) {
    let youthMonths = 0;
    let normalMonths = 0;
    let youthSalary = 0;
    let normalSalary = 0;
    let totalSalary = 0;
  
    let socialInsuranceTotalSalary = 0;
    let socialInsuranceYouthSalary = 0;
    let socialInsuranceNormalSalary = 0;
    let socialInsuranceExcludedSalary = 0;
    let resignationExcludedMonth = null;
  
    // Birthday from ID
    let birthDate = null;
    if (id && id.length >= 6) {
        const front = id.substring(0, 6); 
        let yy = parseInt(front.substring(0, 2));
        if (!isNaN(yy)) {
            let birthYearPrefix = (yy < 30) ? '20' : '19';
            // Adjust for 1900s if it looks like a future date (simple heuristic, can be improved)
            // But standard simple logic:
            const y = parseInt(birthYearPrefix + front.substring(0, 2));
            const m = parseInt(front.substring(2, 4)) - 1; 
            const d = parseInt(front.substring(4, 6));
            birthDate = new Date(y, m, d);
        }
    }
  
    for (let m = 1; m <= 12; m++) {
        const monthEnd = new Date(year, m, 0); 
        
        let salary = 0;
        // Access from JSON maps
        const salVal = empObj.monthly_salary ? (empObj.monthly_salary[m] || 0) : 0;
        const bonVal = empObj.monthly_bonus ? (empObj.monthly_bonus[m] || 0) : 0;
        
        salary = salVal + bonVal;
        totalSalary += salary;
  
        // Age Calculation
        let isYouth = false;
        let age = -1;
        
        if (birthDate) {
            age = calculateManAge(birthDate, monthEnd);
            // 2025 Revision: 15~29 (up to 35 with military)
            // Simplified for now: <= 29
            if (age <= 29) isYouth = true;
        }
  
        // Employment Status
        let isEmployedAtMonthEnd = false;
        if (hireDate && hireDate <= monthEnd) {
            if (!retireDate || retireDate >= monthEnd) {
                isEmployedAtMonthEnd = true;
            }
        }
  
        // Aggregation
        if (isEmployedAtMonthEnd) {
            if (isYouth) youthMonths++;
            else normalMonths++;
        }
  
        if (salary > 0) {
            if (isYouth) youthSalary += salary;
            else normalSalary += salary;
  
            // Social Insurance Exclusions (Resignation Month)
            let isResignationMonth = false;
            if (retireDate && retireDate.getFullYear() === year && retireDate.getMonth() + 1 === m) {
                isResignationMonth = true;
            }
  
            if (!isResignationMonth) {
                if (isYouth) socialInsuranceYouthSalary += salary;
                else socialInsuranceNormalSalary += salary;
                socialInsuranceTotalSalary += salary;
            } else {
                socialInsuranceExcludedSalary += salary;
                resignationExcludedMonth = m; 
            }
        }
    }

    // Age at Year End
    let ageYearEnd = '';
    if (birthDate) {
        ageYearEnd = calculateManAge(birthDate, new Date(year, 12, 0));
    }
  
    return {
        year,
        name,
        id,
        hireDate: hireDate ? hireDate.toISOString().split('T')[0] : null,
        retireDate: retireDate ? retireDate.toISOString().split('T')[0] : null,
        ageYearEnd,
        totalSalary,
        youthMonths,
        normalMonths,
        youthSalary,
        normalSalary,
        socialInsuranceTotalSalary,
        socialInsuranceYouthSalary,
        socialInsuranceNormalSalary,
        socialInsuranceExcludedSalary,
        resignationExcludedMonth,
        isYouth: youthMonths > 0
    };
}

function calculateManAge(birthDate, targetDate) {
    let age = targetDate.getFullYear() - birthDate.getFullYear();
    const m = targetDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && targetDate.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

