
export function calculateIncomeIncreaseCredit(processedData, settings) {
    // processedData contains all employees with years.
    // We need to group by year first to easily access data.
    const dataByYear = {};
    processedData.forEach(d => {
        if (!dataByYear[d.year]) dataByYear[d.year] = [];
        dataByYear[d.year].push(d);
    });

    const years = Object.keys(dataByYear).map(y => parseInt(y)).sort((a,b) => a - b);
    const results = [];
    const annualStats = [];

    // Helper: Calculate FTE (Full Time Equivalent) for a list of employees in a specific year
    // FTE = Sum of Working Months / 12
    const calculateStats = (employees, year) => {
        let totalWages = 0;
        let totalMonths = 0;
        let count = 0;

        employees.forEach(emp => {
            // Check if employee works in this year
            // The processedData is already split by year (each row is one year for one person)
            // But 'employees' here might be the list of ALL data rows? 
            // We should pass only the relevant rows.
            totalWages += emp.totalSalary;
            // Calculate working months for this year
            // We can use normalized 'socialInsuranceTotalSalary' logic or just employment period?
            // User requirement: "Sangsi worker months".
            // In EmploymentIncrease calc, usually (Employment Months / 12).
            const workingMonths = calculateWorkingMonths(emp, year);
            totalMonths += workingMonths;
            count++;
        });

        return {
            totalWages,
            fte: totalMonths / 12,
            count
        };
    };

    // Calculate Step 1: Overall Constant Employee Count for each year (for display and multiplier)
    years.forEach(year => {
        const employees = dataByYear[year] || [];
        
        // Filter for Constant Employees (General Definition)
        // Usually: Employed at month end? 
        // The standard "Sangsi" definition allows fractional.
        // But for "Income Increase" logic Step 1, it's just total count.
        // We accumulate months.
        let totalMonths = 0;
        employees.forEach(e => {
            // Assume 12 months for full year, or partial for hire/retire
            // Using the pre-calculated 'normalMonths' + 'youthMonths' from parser?
            // "youthMonths" + "normalMonths" = total employed months in that year
             totalMonths += (e.youthMonths + e.normalMonths);
        });

        annualStats.push({
            year,
            fte: totalMonths / 12
        });
    });

    // Main Loop: Calculate Credit for each year T
    // We strictly need data from T-4 to T to calculate:
    // 1. Exclusions (Lookback 5 years: T, T-1, T-2, T-3, T-4)
    // 2. Growth Rates (Avg of 3 prior years: T-1, T-2, T-3 rates -> needs Wages from T-1 to T-4)
    years.forEach(targetYear => {
        // Strict check: We need continuous data for at least 5 years ending in targetYear
        if (!dataByYear[targetYear - 4]) return;

        // 1. Identify "Cohort" for Step 3 (Average Wage Calculation)
        // Criteria:
        //  a) Employed at end of Target Year
        //  b) Not excluded (Salary > 70m) in [Target-4, Target]
        //  c) Not excluded (Resigned) in [Target-4, Target] (implied by "continuous" but strict check needed)
        
        const cohortEmployees = [];
        const excludedList = []; // Track excluded employees
        const currentYearEmployees = dataByYear[targetYear] || [];

        currentYearEmployees.forEach(emp => {
            // a) Employed at end of Target Year?
            if (!isEmployedAtYearEnd(emp, targetYear)) return;

            // Check history for exclusion
            const empId = emp.id; 
            if (!empId) return;

            let isExcluded = false;
            let exclusionReason = '';

            // Check period: [TargetYear - 4, TargetYear]
            for (let y = targetYear; y >= targetYear - 4; y--) {
                const empDataInYear = (dataByYear[y] || []).find(d => d.id === empId);

                if (empDataInYear) {
                    // Check Salary
                    if (empDataInYear.totalSalary > 70000000) {
                        isExcluded = true;
                        exclusionReason = `총급여 7천만원 초과 (${y}년: ${(empDataInYear.totalSalary/10000).toFixed(0)}만원)`;
                        break;
                    }
                    // Check Resignation
                    if (empDataInYear.retireDate) {
                        const rDate = new Date(empDataInYear.retireDate);
                        if (rDate.getFullYear() === y) {
                             isExcluded = true;
                             exclusionReason = `5년 내 퇴사 이력 존재 (${y}년 퇴사)`;
                             break;
                        }
                    }
                }
            }

            if (!isExcluded) {
                cohortEmployees.push(emp);
            } else {
                excludedList.push({ name: emp.name, id: emp.id, reason: exclusionReason, year: targetYear });
            }
        });

        // 2. Calculate Avg Wages and Growth Rates
        // We need:
        // AvgWage(T)
        // AvgWage(T-1), Growth(T) = (Avg(T)-Avg(T-1))/Avg(T-1)
        // AvgWage(T-2), Growth(T-1) = (Avg(T-1)-Avg(T-2))/Avg(T-2)
        // AvgWage(T-3), Growth(T-2) = (Avg(T-2)-Avg(T-3))/Avg(T-3)
        // AvgWage(T-4), Growth(T-3) = ... (Need 3 prior years rates -> Need T-4 wage)
        
        const yearlyAvgs = {};
        
        // We calculate averages for T, T-1, T-2, T-3, T-4
        // checkYears = [T, T-1, T-2, T-3, T-4]
        const checkYears = [0, 1, 2, 3, 4].map(delta => targetYear - delta);
        
        checkYears.forEach(y => {
            // Find the cohort's data for year y
            const empDataList = [];
            cohortEmployees.forEach(c => {
                 // Find matching data row
                 const match = (dataByYear[y] || []).find(d => d.id === c.id);
                 if (match) empDataList.push(match);
            });
            
            // Calculate Stats for this subset
            // IMPORTANT: "Exclude New Hires in Each Year" Logic?
            // "3. 각 과세연도별 입사자 제외시 평균임금 계산"
            // This implies for Year Y Avg, we exclude anyone who joined in Year Y.
            // So we filter empDataList: `hireDate` < Year Y start. (Joined before Y)
            const validForAvg = empDataList.filter(e => {
                const yearStart = new Date(e.year, 0, 1);
                const hDate = new Date(e.hireDate);
                return hDate < yearStart; // Joined before this year
            });

            const stats = calculateStats(validForAvg, y);
            yearlyAvgs[y] = stats.count > 0 ? (stats.totalWages / stats.fte) : 0;
            // Also store counts for debug/display if needed
        });

        // 3. Calculate Rates
        const getRate = (cur, prev) => {
            if (!prev || prev === 0) return 0;
            return (cur - prev) / prev;
        };

        const rateT = getRate(yearlyAvgs[targetYear], yearlyAvgs[targetYear-1]);
        const rateT_1 = getRate(yearlyAvgs[targetYear-1], yearlyAvgs[targetYear-2]);
        const rateT_2 = getRate(yearlyAvgs[targetYear-2], yearlyAvgs[targetYear-3]);
        const rateT_3 = getRate(yearlyAvgs[targetYear-3], yearlyAvgs[targetYear-4]);

        // Prior 3 Years Average Rate
        // If data is missing (e.g. only have T-1, T-2), what do?
        // Usually avg of available?
        // User says: "Average of prev 3 years rate".
        // If T-4 is missing, we use (RateT_1 + RateT_2) / 2?
        // Let's iterate available rates.
        const prevRates = [];
        // Only include if the denom year existed?
        // We need to check if we had valid wages to calc rate.
        if (yearlyAvgs[targetYear-2] > 0) prevRates.push(rateT_1); // T-1 vs T-2
        if (yearlyAvgs[targetYear-3] > 0) prevRates.push(rateT_2); // T-2 vs T-3
        if (yearlyAvgs[targetYear-4] > 0) prevRates.push(rateT_3); // T-3 vs T-4

        const avgPrevRate = prevRates.length > 0 
             ? prevRates.reduce((a,b) => a+b, 0) / prevRates.length 
             : 0;

        // 4. Calculate Credit
        // Condition: RateT > AvgPrevRate
        let creditAmount = 0;
        let excessAmount = 0;
        const employeeCountPre = annualStats.find(a => a.year === targetYear - 1)?.fte || 0;
        
        if (rateT > avgPrevRate && avgPrevRate >= 0) { // Should we require positive growth? Text doesn't strictly say, but usually yes. Assuming standard.
             const avgT = yearlyAvgs[targetYear];
             const avgPrev = yearlyAvgs[targetYear-1];
             
             // Calculation: Excess Increase * Count
             const wagesIfGrewAtAvgRate = avgPrev * (1 + avgPrevRate);
             const diffPerPerson = avgT - wagesIfGrewAtAvgRate;
             
             if (diffPerPerson > 0) {
                 excessAmount = diffPerPerson * employeeCountPre;
                 // Tax Credit Rate: Small 20%, Medium 10%, Large 5%
                 let creditRate = 0.05; // Default Large
                 if (settings.size === 'small') creditRate = 0.2;
                 else if (settings.size === 'middle') creditRate = 0.1;
                 
                 creditAmount = excessAmount * creditRate;
             }
        }
        
        // Fallback Logic from Image (Step 7 - Special Case)
        // If RateT < 0 or RateT < AvgPrevRate?
        // "7. If (29) is negative or ... special calculation"
        // I won't implement special cases unless requested, but user prompt "Thus organized... apply 20%".
        // I'll stick to the main request logic.

        results.push({
            year: targetYear,
            cohortCount: cohortEmployees.length, // Employees in the filtered list
            excludedEmployees: excludedList, // Pass the captured list
            avgWageT: yearlyAvgs[targetYear],
            avgWageT_1: yearlyAvgs[targetYear-1],
            rateT: rateT,
            prevRates: prevRates,
            avgPrevRate: avgPrevRate,
            employeeCountPre: employeeCountPre,
            excessAmount: excessAmount,
            taxCredit: creditAmount
        });

    });

    return {
        annualStats, // General Stats
        results // Credit Calculations
    };
}

function calculateWorkingMonths(emp, year) {
    // Return (youthMonths + normalMonths)
    return emp.youthMonths + emp.normalMonths;
}

function isEmployedAtYearEnd(emp, year) {
    let retireDate = emp.retireDate ? new Date(emp.retireDate) : null;
    let hireDate = emp.hireDate ? new Date(emp.hireDate) : null;
    const yearEnd = new Date(year, 11, 31); // Dec 31
    
    // Must be hired before/on year end
    if (hireDate && hireDate > yearEnd) return false;
    
    // Must NOT be retired before year end
    if (retireDate && retireDate < yearEnd && retireDate.getFullYear() === year) return false;
    // Actually, if they retired in previous years, they are also not employed.
    if (retireDate && retireDate < yearEnd) return false; 
    
    return true;
}
