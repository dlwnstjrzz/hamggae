
import ExcelJS from 'exceljs';

/**
 * Generates and downloads an Excel file containing tax credit corroboration data.
 * 
 * @param {Array} processedData - Array of all employee data with 'year' property.
 * @param {Object} incomeIncreaseResults - Result object from calculateIncomeIncreaseCredit containing 'results' array.
 */
export async function generateTaxCreditExcel(processedData, incomeIncreaseResults) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mega-Info Consulting';
    workbook.lastModifiedBy = 'Mega-Info Consulting';
    workbook.created = new Date();
    workbook.modified = new Date();

    const dataByYear = {};
    processedData.forEach(d => {
        if (!dataByYear[d.year]) dataByYear[d.year] = [];
        dataByYear[d.year].push(d);
    });

    const sortedYears = Object.keys(dataByYear).sort((a, b) => b - a);

    // --- Part 1: Annual Regular Employee Sheets ([Year] 상시근로자) ---
    sortedYears.forEach(year => {
        const sheetName = `${year} 상시근로자`;
        const sheet = workbook.addWorksheet(sheetName);

        // Define Columns
        sheet.columns = [
            { header: '성명', key: 'name', width: 12 },
            { header: '주민등록번호', key: 'id', width: 18 },
            { header: '입사일', key: 'hireDate', width: 12 },
            { header: '퇴사일', key: 'retireDate', width: 12 },
            { header: '총급여', key: 'totalSalary', width: 15, style: { numFmt: '#,##0' } },
            { header: '청년여부', key: 'isYouth', width: 10 },
            { header: '청년근속(월)', key: 'youthMonths', width: 12, style: { numFmt: '0.00' } },
            { header: '일반근속(월)', key: 'normalMonths', width: 12, style: { numFmt: '0.00' } },
            { header: '제외사유', key: 'exclusionReason', width: 25 },
        ];

        // Style Header
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        const employees = dataByYear[year].sort((a, b) => a.name.localeCompare(b.name));
        employees.forEach(emp => {
            sheet.addRow({
                name: emp.name,
                id: emp.id,
                hireDate: emp.hireDate,
                retireDate: emp.retireDate,
                totalSalary: emp.totalSalary,
                isYouth: emp.isYouth ? '청년' : '청년외',
                youthMonths: emp.youthMonths,
                normalMonths: emp.normalMonths,
                exclusionReason: emp.exclusionReason || ''
            });
        });
    });


    // --- Part 2: Income Increase Cohort Sheets ([Year] 근로소득증대) ---
    if (incomeIncreaseResults && incomeIncreaseResults.results) {
        const sortedResults = [...incomeIncreaseResults.results].sort((a, b) => b.year - a.year);

        sortedResults.forEach(res => {
            const targetYear = res.year;

            // Define Common Columns for Cohort History
            const columns = [
                { header: '성명', key: 'name', width: 12 },
                { header: '주민등록번호', key: 'id', width: 18 },
                { header: '제외사유', key: 'reason', width: 20 },
            ];
            // Add columns for history (T down to T-4)
            for (let i = 0; i < 5; i++) {
                const y = targetYear - i;
                columns.push({ header: `${y} 급여`, key: `salary_${y}`, width: 12, style: { numFmt: '#,##0' } });
                columns.push({ header: `${y} 근무월`, key: `months_${y}`, width: 8, style: { numFmt: '0.00' } });
            }

            // --- Sheet 2-A: Included Cohort ---
            const sheetIncluded = workbook.addWorksheet(`${targetYear} 근로소득증대(대상)`);
            sheetIncluded.columns = columns;
            sheetIncluded.getRow(1).font = { bold: true };
            sheetIncluded.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            if (res.includedEmployees) {
                res.includedEmployees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
                    const row = {
                        name: emp.name,
                        id: emp.id,
                        reason: ''
                    };
                    // History Data
                    for (let i = 0; i < 5; i++) {
                        const y = targetYear - i;
                        const histData = res.history && res.history[y] ? res.history[y].includedEmployees : [];
                        const match = histData.find(d => d.id === emp.id); // Assuming ID consistency

                        row[`salary_${y}`] = match ? match.totalSalary : 0;
                        row[`months_${y}`] = match ? (match.youthMonths + match.normalMonths) : 0;
                    }
                    sheetIncluded.addRow(row);
                });
            }

            // --- Sheet 2-B: Excluded Cohort ---
            const sheetExcluded = workbook.addWorksheet(`${targetYear} 근로소득증대(제외)`);
            sheetExcluded.columns = columns;
            sheetExcluded.getRow(1).font = { bold: true };
            sheetExcluded.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

            if (res.excludedEmployees) {
                 res.excludedEmployees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
                    const row = {
                        name: emp.name,
                        id: emp.id,
                        reason: emp.reason || ''
                    };
                    // Fill Only Target Year Data (Usually available in emp object itself)
                    row[`salary_${targetYear}`] = emp.totalSalary || 0;
                    row[`months_${targetYear}`] = (emp.youthMonths || 0) + (emp.normalMonths || 0);

                    sheetExcluded.addRow(row);
                 });
            }
        });
    }

    // Generate Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Create Blob and Download
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `세액공제_소명자료_${new Date().toISOString().slice(0,10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Generates an Excel file for employees who resigned within 1 year of their hire date.
 * 
 * @param {Array} processedData - Array of all employee data.
 */
export async function downloadShortTermResignersExcel(processedData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mega-Info Consulting';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('1년 이내 퇴사자 명단');

    sheet.columns = [
        { header: '성명', key: 'name', width: 15 },
        { header: '주민등록번호', key: 'id', width: 20 },
        { header: '입사일', key: 'hireDate', width: 15 },
        { header: '퇴사일', key: 'retireDate', width: 15 },
        { header: '총급여', key: 'totalSalary', width: 20, style: { numFmt: '#,##0' } },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Group by ID to sum up salaries and find unique hire/retire dates
    const grouped = {};
    processedData.forEach(d => {
        if (!grouped[d.id]) {
            grouped[d.id] = {
                name: d.name,
                id: d.id,
                hireDate: d.hireDate,
                retireDate: d.retireDate,
                totalSalary: 0
            };
        }
        // Update dates if missing (should be consistent, but just in case)
        if (d.hireDate && !grouped[d.id].hireDate) grouped[d.id].hireDate = d.hireDate;
        if (d.retireDate && !grouped[d.id].retireDate) grouped[d.id].retireDate = d.retireDate;
        
        grouped[d.id].totalSalary += (d.totalSalary || 0);
    });

    const shortTermResigners = Object.values(grouped).filter(emp => {
        if (!emp.hireDate || !emp.retireDate) return false;
        
        const hDate = new Date(emp.hireDate);
        const rDate = new Date(emp.retireDate);
        
        // Calculate difference in milliseconds
        const diffTime = Math.abs(rDate - hDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        return diffDays <= 365;
    }).sort((a, b) => a.name.localeCompare(b.name));

    shortTermResigners.forEach(emp => {
        sheet.addRow({
            name: emp.name,
            id: emp.id,
            hireDate: emp.hireDate,
            retireDate: emp.retireDate,
            totalSalary: emp.totalSalary
        });
    });

    // Generate Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Create Blob and Download
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `1년이내_퇴사자_명단_${new Date().toISOString().slice(0,10)}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

function createEmployeeListSheet(workbook, sheetName, employees, useIntegrated = false) {
    const sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
        { header: '성명', key: 'name', width: 12 },
        { header: '주민등록번호', key: 'id', width: 18 },
        { header: '입사일', key: 'hireDate', width: 12 },
        { header: '퇴사일', key: 'retireDate', width: 12 },
        { header: '총급여', key: 'totalSalary', width: 15, style: { numFmt: '#,##0' } },
        { header: '청년여부', key: 'isYouth', width: 10 },
        { header: '청년근속(월)', key: 'youthMonths', width: 12, style: { numFmt: '0' } },
        { header: '일반근속(월)', key: 'normalMonths', width: 12, style: { numFmt: '0' } },
        { header: '제외사유', key: 'exclusionReason', width: 25 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    employees.forEach(emp => {
        sheet.addRow({
            name: emp.name,
            id: emp.id,
            hireDate: emp.hireDate,
            retireDate: emp.retireDate || '',
            totalSalary: emp.totalSalary,
            isYouth: emp.isYouth ? '청년' : '청년외',
            youthMonths: useIntegrated ? (emp.integratedYouthMonths ?? 0) : (emp.youthMonths ?? 0),
            normalMonths: useIntegrated ? (emp.integratedNormalMonths ?? 0) : (emp.normalMonths ?? 0),
            exclusionReason: emp.exclusionReason || '',
        });
    });
}

function sortEmployeeList(employees) {
    return [...employees].sort((a, b) => {
        if (a.exclusionReason && !b.exclusionReason) return 1;
        if (!a.exclusionReason && b.exclusionReason) return -1;
        return (b.totalSalary || 0) - (a.totalSalary || 0);
    });
}

async function downloadWorkbook(workbook, fileName) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

export async function downloadEmploymentIncreaseList(processedData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mega-Info Consulting';
    workbook.created = new Date();

    const dataByYear = {};
    processedData.forEach(d => {
        if (!dataByYear[d.year]) dataByYear[d.year] = [];
        dataByYear[d.year].push(d);
    });

    Object.keys(dataByYear).sort((a, b) => b - a).forEach(year => {
        createEmployeeListSheet(workbook, `${year}년`, sortEmployeeList(dataByYear[year]), false);
    });

    await downloadWorkbook(workbook, `고용증대_상시근로자_리스트_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadIntegratedEmploymentList(processedData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mega-Info Consulting';
    workbook.created = new Date();

    const dataByYear = {};
    processedData.filter(d => d.year >= 2022).forEach(d => {
        if (!dataByYear[d.year]) dataByYear[d.year] = [];
        dataByYear[d.year].push(d);
    });

    Object.keys(dataByYear).sort((a, b) => b - a).forEach(year => {
        createEmployeeListSheet(workbook, `${year}년`, sortEmployeeList(dataByYear[year]), true);
    });

    await downloadWorkbook(workbook, `통합고용_상시근로자_리스트_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadSocialInsuranceList(processedData) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mega-Info Consulting';
    workbook.created = new Date();

    const dataByYear = {};
    processedData.forEach(d => {
        if (!dataByYear[d.year]) dataByYear[d.year] = [];
        dataByYear[d.year].push(d);
    });

    Object.keys(dataByYear).sort((a, b) => b - a).forEach(year => {
        createEmployeeListSheet(workbook, `${year}년`, sortEmployeeList(dataByYear[year]), false);
    });

    await downloadWorkbook(workbook, `사회보험_상시근로자_리스트_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export async function downloadIncomeIncreaseList(incomeIncreaseResults) {
    if (!incomeIncreaseResults?.results?.length) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mega-Info Consulting';
    workbook.created = new Date();

    const includedColumns = [
        { header: '성명', key: 'name', width: 12 },
        { header: '입사일', key: 'hireDate', width: 12 },
        { header: '퇴사일', key: 'retireDate', width: 12 },
        { header: '총급여', key: 'totalSalary', width: 15, style: { numFmt: '#,##0' } },
        { header: '근속월수', key: 'totalMonths', width: 12, style: { numFmt: '0' } },
    ];
    const excludedColumns = [
        ...includedColumns,
        { header: '제외사유', key: 'reason', width: 25 },
    ];

    [...incomeIncreaseResults.results].sort((a, b) => a.year - b.year).forEach(record => {
        const targetYear = record.year;

        const includedEmps = record.history?.[targetYear]?.includedEmployees || record.includedEmployees || [];
        const includedSheet = workbook.addWorksheet(`${targetYear}년 귀속분 포함대상`);
        includedSheet.columns = includedColumns;
        includedSheet.getRow(1).font = { bold: true };
        includedSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        [...includedEmps].sort((a, b) => (b.totalSalary || 0) - (a.totalSalary || 0)).forEach(emp => {
            includedSheet.addRow({
                name: emp.name,
                hireDate: emp.hireDate,
                retireDate: emp.retireDate || '',
                totalSalary: emp.totalSalary || 0,
                totalMonths: (emp.youthMonths || 0) + (emp.normalMonths || 0),
            });
        });

        const excludedEmps = record.history?.[targetYear]?.excludedEmployees || record.excludedEmployees || [];
        const excludedSheet = workbook.addWorksheet(`${targetYear}년 귀속분 미포함대상`);
        excludedSheet.columns = excludedColumns;
        excludedSheet.getRow(1).font = { bold: true };
        excludedSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        [...excludedEmps].sort((a, b) => (b.totalSalary || 0) - (a.totalSalary || 0)).forEach(emp => {
            excludedSheet.addRow({
                name: emp.name,
                hireDate: emp.hireDate,
                retireDate: emp.retireDate || '',
                totalSalary: emp.totalSalary || 0,
                totalMonths: (emp.youthMonths || 0) + (emp.normalMonths || 0),
                reason: emp.reason || '',
            });
        });
    });

    await downloadWorkbook(workbook, `근로소득증대_상시근로자_리스트_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
