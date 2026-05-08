
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

function createSummaryExclusionSheet(workbook, sheetName, employees, allYears) {
    const sheet = workbook.addWorksheet(sheetName);
    const grouped = {};

    employees.forEach(emp => {
        const hasExecutiveExclusion = emp.executivePeriods && emp.executivePeriods.length > 0 && !emp.forceIncludeExec;
        if (!grouped[emp.id]) {
            grouped[emp.id] = {
                name: emp.name,
                id: emp.id,
                hireDate: emp.hireDate || '',
                retireDate: emp.retireDate || '',
                years: {},
            };
        }

        grouped[emp.id].years[emp.year] = {
            exclusionReason: emp.exclusionReason || (hasExecutiveExclusion ? '임원' : ''),
            totalSalary: emp.totalSalary || 0,
        };
        if (!grouped[emp.id].hireDate && emp.hireDate) grouped[emp.id].hireDate = emp.hireDate;
        if (!grouped[emp.id].retireDate && emp.retireDate) grouped[emp.id].retireDate = emp.retireDate;
    });

    sheet.columns = [
        { header: '이름', key: 'name', width: 12 },
        { header: '인적 사항', key: 'info', width: 24 },
        ...allYears.map(year => ({ header: `${year}년`, key: `year_${year}`, width: 18 })),
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    Object.values(grouped)
        .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.id.localeCompare(b.id, 'ko'))
        .forEach(person => {
            const row = {
                name: person.name,
                info: `${person.id || ''}${person.hireDate || person.retireDate ? `\n${person.hireDate || ''}${person.retireDate ? ` / ${person.retireDate}` : ''}` : ''}`,
            };

            allYears.forEach(year => {
                const yearData = person.years[year];
                row[`year_${year}`] = yearData
                    ? `${yearData.exclusionReason || '제외'}\n${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(yearData.totalSalary)}`
                    : '';
            });

            sheet.addRow(row);
        });

    sheet.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 22 : 34;
        row.eachCell(cell => {
            cell.alignment = {
                vertical: 'middle',
                horizontal: rowNumber === 1 ? 'center' : 'center',
                wrapText: true,
            };
        });
    });

    allYears.forEach((year, index) => {
        const col = sheet.getColumn(index + 3);
        col.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
}

function sortSummaryEmployeeList(employees) {
    return [...employees].sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        if (a.exclusionReason && !b.exclusionReason) return 1;
        if (!a.exclusionReason && b.exclusionReason) return -1;
        return (b.totalSalary || 0) - (a.totalSalary || 0);
    });
}

export async function downloadSummaryEmployeeLists(processedData, manuallyExcludedIds = []) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Mega-Info Consulting';
    workbook.created = new Date();

    const excludedIds = new Set(manuallyExcludedIds);
    processedData.forEach(emp => {
        if (emp.exclusionReason || (emp.executivePeriods && emp.executivePeriods.length > 0 && !emp.forceIncludeExec)) {
            excludedIds.add(emp.id);
        }
    });

    const dataByYear = {};
    const allYears = [...new Set(processedData.map(emp => emp.year))].sort((a, b) => a - b);
    processedData.forEach(emp => {
        if (excludedIds.has(emp.id)) return;
        if (!dataByYear[emp.year]) dataByYear[emp.year] = [];
        dataByYear[emp.year].push(emp);
    });

    Object.keys(dataByYear)
        .sort((a, b) => b - a)
        .forEach(year => {
            createEmployeeListSheet(workbook, `${year}년`, sortEmployeeList(dataByYear[year]), false);
        });

    createSummaryExclusionSheet(
        workbook,
        '제외 대상자 명단',
        sortSummaryEmployeeList(processedData.filter(emp => excludedIds.has(emp.id))),
        allYears
    );

    await downloadWorkbook(workbook, `최종집계_사원리스트_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

    [...incomeIncreaseResults.results].sort((a, b) => a.year - b.year).forEach(record => {
        const targetYear = record.year;
        const sheet = workbook.addWorksheet(`${targetYear}년 귀속분`);
        const historyYears = Object.keys(record.history || {})
            .map(Number)
            .sort((a, b) => a - b);

        const sheetTitleBg = 'FFF3F4F6';
        const includedTitleBg = 'FFD8EBC8';
        const newHireExcludedTitleBg = 'FFFCE2A8';
        const excludedListTitleBg = 'FFFFF1F2';
        const yearBg = 'FFDCE6F2';
        const includedHeaderBg = 'FFE8F2FF';
        const newHireExcludedHeaderBg = 'FFFFF7D6';
        const excludedHeaderBg = 'FFFFE1E8';
        const border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
        };

        const writeCell = (row, col, value, fillColor = null, bold = false, numFmt = null, alignment = null) => {
            const cell = sheet.getCell(row, col);
            cell.value = value;
            cell.border = border;
            cell.font = { bold };
            cell.alignment = alignment || { vertical: 'middle', horizontal: 'center', wrapText: true };
            if (fillColor) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: fillColor },
                };
            }
            if (numFmt) cell.numFmt = numFmt;
        };

        const getTotalMonths = (emp) => (emp.youthMonths || 0) + (emp.normalMonths || 0);
        const writeMergedCell = (row, startCol, endCol, value, fillColor, bold = true) => {
            sheet.mergeCells(row, startCol, row, endCol);
            writeCell(row, startCol, value, fillColor, bold);
            for (let col = startCol + 1; col <= endCol; col++) {
                const cell = sheet.getCell(row, col);
                cell.border = border;
                if (fillColor) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: fillColor },
                    };
                }
            }
        };

        const sortBySalary = (employees) => [...employees].sort((a, b) => {
            const salaryDiff = (b.totalSalary || 0) - (a.totalSalary || 0);
            if (salaryDiff !== 0) return salaryDiff;
            return (a.name || '').localeCompare(b.name || '');
        });
        const isHiredBeforeYear = (emp, year) => {
            if (!emp?.hireDate) return false;
            const hireDate = emp.hireDate instanceof Date ? emp.hireDate : new Date(emp.hireDate);
            if (Number.isNaN(hireDate.getTime())) return false;
            return hireDate < new Date(year, 0, 1);
        };
        const formatDate = (value) => {
            if (!value) return '';
            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) return value;
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const yearTables = historyYears.map(year => {
            const yearData = record.history?.[year] || {};
            const includedEmployees = sortBySalary(yearData.includedEmployees || []);
            const noNewHireEmployees = sortBySalary(includedEmployees.filter(emp => isHiredBeforeYear(emp, year)));
            return { year, includedEmployees, noNewHireEmployees };
        });
        const excludedEmployees = [...(record.excludedEmployees || [])].sort((a, b) => {
            const reasonDiff = (a.reason || '').localeCompare(b.reason || '');
            if (reasonDiff !== 0) return reasonDiff;
            return (a.name || '').localeCompare(b.name || '');
        });

        const tableHeaders = ['성명', '주민등록번호', '근무개월수', '총급여액'];
        const blockWidth = tableHeaders.length;
        const yearGapWidth = 1;
        const sectionGapWidth = 2;
        const sectionWidth = historyYears.length > 0
            ? historyYears.length * blockWidth + (historyYears.length - 1) * yearGapWidth
            : blockWidth;
        const leftSectionStart = 1;
        const leftSectionEnd = leftSectionStart + sectionWidth - 1;
        const rightSectionStart = leftSectionEnd + sectionGapWidth + 1;
        const rightSectionEnd = rightSectionStart + sectionWidth - 1;
        const totalWidth = rightSectionEnd;
        const includedMaxRows = Math.max(...yearTables.map(table => table.includedEmployees.length), 1);
        const noNewHireMaxRows = Math.max(...yearTables.map(table => table.noNewHireEmployees.length), 1);
        const dataRows = Math.max(includedMaxRows, noNewHireMaxRows);

        writeMergedCell(1, 1, totalWidth, `${targetYear}년 귀속분 근로소득증대 상시근로자 리스트`, sheetTitleBg);
        writeMergedCell(2, leftSectionStart, leftSectionEnd, '신규 입사자 포함 리스트', includedTitleBg);
        writeMergedCell(2, rightSectionStart, rightSectionEnd, '신규 입사자 제외 리스트', newHireExcludedTitleBg);

        yearTables.forEach((table, index) => {
            const leftStartCol = leftSectionStart + index * (blockWidth + yearGapWidth);
            const rightStartCol = rightSectionStart + index * (blockWidth + yearGapWidth);

            writeMergedCell(3, leftStartCol, leftStartCol + blockWidth - 1, `${table.year}년`, yearBg);
            writeMergedCell(3, rightStartCol, rightStartCol + blockWidth - 1, `${table.year}년`, yearBg);

            tableHeaders.forEach((header, offset) => {
                writeCell(4, leftStartCol + offset, header, includedHeaderBg, true);
                writeCell(4, rightStartCol + offset, header, newHireExcludedHeaderBg, true);
            });

            for (let i = 0; i < dataRows; i++) {
                const row = 5 + i;
                const included = table.includedEmployees[i];
                const noNewHire = table.noNewHireEmployees[i];

                writeCell(row, leftStartCol, included?.name || '');
                writeCell(row, leftStartCol + 1, included?.id || '');
                writeCell(row, leftStartCol + 2, included ? getTotalMonths(included) : '', null, false, '0');
                writeCell(row, leftStartCol + 3, included ? (included.totalSalary || 0) : '', null, false, '#,##0');

                writeCell(row, rightStartCol, noNewHire?.name || '');
                writeCell(row, rightStartCol + 1, noNewHire?.id || '');
                writeCell(row, rightStartCol + 2, noNewHire ? getTotalMonths(noNewHire) : '', null, false, '0');
                writeCell(row, rightStartCol + 3, noNewHire ? (noNewHire.totalSalary || 0) : '', null, false, '#,##0');
            }

            const totalRow = 5 + dataRows;
            writeCell(totalRow, leftStartCol, '합계', includedHeaderBg, true);
            writeCell(totalRow, leftStartCol + 1, table.includedEmployees.length, includedHeaderBg, true, '0');
            writeCell(
                totalRow,
                leftStartCol + 2,
                table.includedEmployees.reduce((sum, emp) => sum + getTotalMonths(emp), 0),
                includedHeaderBg,
                true,
                '0'
            );
            writeCell(
                totalRow,
                leftStartCol + 3,
                table.includedEmployees.reduce((sum, emp) => sum + (emp.totalSalary || 0), 0),
                includedHeaderBg,
                true,
                '#,##0'
            );

            writeCell(totalRow, rightStartCol, '합계', newHireExcludedHeaderBg, true);
            writeCell(totalRow, rightStartCol + 1, table.noNewHireEmployees.length, newHireExcludedHeaderBg, true, '0');
            writeCell(
                totalRow,
                rightStartCol + 2,
                table.noNewHireEmployees.reduce((sum, emp) => sum + getTotalMonths(emp), 0),
                newHireExcludedHeaderBg,
                true,
                '0'
            );
            writeCell(
                totalRow,
                rightStartCol + 3,
                table.noNewHireEmployees.reduce((sum, emp) => sum + (emp.totalSalary || 0), 0),
                newHireExcludedHeaderBg,
                true,
                '#,##0'
            );
        });

        const excludedTitleRow = 8 + dataRows;
        writeMergedCell(excludedTitleRow, 1, 4, '제외 대상 리스트', excludedListTitleBg);
        ['성명', '주민등록번호', '제외사유', '퇴사일'].forEach((header, offset) => {
            writeCell(excludedTitleRow + 1, 1 + offset, header, excludedHeaderBg, true);
        });

        const excludedDataRows = Math.max(excludedEmployees.length, 1);
        for (let i = 0; i < excludedDataRows; i++) {
            const row = excludedTitleRow + 2 + i;
            const excluded = excludedEmployees[i];
            writeCell(row, 1, excluded?.name || '');
            writeCell(row, 2, excluded?.id || '');
            writeCell(
                row,
                3,
                excluded?.reason || '',
                null,
                false,
                null,
                { vertical: 'middle', horizontal: 'left', wrapText: true }
            );
            writeCell(row, 4, formatDate(excluded?.retireDate || ''));
        }

        const excludedTotalRow = excludedTitleRow + 2 + excludedDataRows;
        writeCell(excludedTotalRow, 1, '합계', excludedHeaderBg, true);
        writeCell(excludedTotalRow, 2, excludedEmployees.length, excludedHeaderBg, true, '0');
        writeCell(excludedTotalRow, 3, '', excludedHeaderBg, true);
        writeCell(excludedTotalRow, 4, '', excludedHeaderBg, true);

        for (let index = 0; index < historyYears.length; index++) {
            const leftStartCol = leftSectionStart + index * (blockWidth + yearGapWidth);
            const rightStartCol = rightSectionStart + index * (blockWidth + yearGapWidth);

            sheet.getColumn(leftStartCol).width = 12;
            sheet.getColumn(leftStartCol + 1).width = 18;
            sheet.getColumn(leftStartCol + 2).width = 10;
            sheet.getColumn(leftStartCol + 3).width = 14;

            sheet.getColumn(rightStartCol).width = 12;
            sheet.getColumn(rightStartCol + 1).width = 18;
            sheet.getColumn(rightStartCol + 2).width = 10;
            sheet.getColumn(rightStartCol + 3).width = 14;

            if (index < historyYears.length - 1) {
                sheet.getColumn(leftStartCol + blockWidth).width = 3;
                sheet.getColumn(rightStartCol + blockWidth).width = 3;
            }
        }

        sheet.getColumn(leftSectionEnd + 1).width = 3;
        sheet.getColumn(leftSectionEnd + 2).width = 3;
        sheet.getColumn(1).width = Math.max(sheet.getColumn(1).width || 0, 12);
        sheet.getColumn(2).width = Math.max(sheet.getColumn(2).width || 0, 18);
        sheet.getColumn(3).width = Math.max(sheet.getColumn(3).width || 0, 28);
        sheet.getColumn(4).width = Math.max(sheet.getColumn(4).width || 0, 12);

        sheet.views = [{ state: 'frozen', ySplit: 4 }];
    });

    await downloadWorkbook(workbook, `근로소득증대_상시근로자_리스트_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
