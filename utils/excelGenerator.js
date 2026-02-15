
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
