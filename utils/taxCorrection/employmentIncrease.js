/**
 * Calculates the annual average employee counts and tax credit amounts.
 * @param {Array} employeeData - List of processed employee objects from parseEmployeeData
 * @param {Object} settings - { region: 'capital' | 'non-capital', size: 'small' | 'middle' | 'large' }
 */
// Main Entry Point
export function calculateEmploymentIncreaseCredit(employeeData, settings) {
    const annualAverages = calculateAnnualAverages(employeeData);
    
    // 1. Employment Increase Credit (Previous Logic, Applicable for all years as requested)
    const employmentIncreaseResults = calculateCreditAmounts(annualAverages, settings);

    // 2. Integrated Employment Credit (New Logic, 2023 onwards)
    const integratedEmploymentResults = calculateIntegratedCredit(annualAverages, settings);

    const integratedAverages = annualAverages.map(stat => {
        if (stat.year >= 2022 && stat.integratedYouthCount !== undefined) {
            return {
                ...stat,
                youthCount: stat.integratedYouthCount,
                normalCount: stat.integratedNormalCount,
                overallCount: Number((stat.integratedYouthCount + stat.integratedNormalCount).toFixed(2)),
                totalYouthSalary: stat.totalIntegratedYouthSalary,
                totalNormalSalary: stat.totalIntegratedNormalSalary
            };
        }
        return stat;
    });

    return { 
        annualAverages, 
        integratedAverages,
        results: employmentIncreaseResults, // Backward compatibility for UI check
        employmentIncreaseResults,
        integratedEmploymentResults 
    };
}

function calculateAnnualAverages(employeeData) {
    // 1. Group by Year
    const byYear = {};
    employeeData.forEach(emp => {
        if (!byYear[emp.year]) {
            byYear[emp.year] = { 
                year: emp.year, 
                totalYouthMonths: 0, 
                totalNormalMonths: 0,
                totalIntegratedYouthMonths: 0,
                totalIntegratedNormalMonths: 0,
                totalYouthSalary: 0,
                totalNormalSalary: 0,
                totalIntegratedYouthSalary: 0,
                totalIntegratedNormalSalary: 0,
                youthCount: 0,
                normalCount: 0,
                overallCount: 0
            };
        }
        byYear[emp.year].totalYouthMonths += emp.youthMonths;
        byYear[emp.year].totalNormalMonths += emp.normalMonths;
        
        byYear[emp.year].totalIntegratedYouthMonths += (emp.integratedYouthMonths || 0);
        byYear[emp.year].totalIntegratedNormalMonths += (emp.integratedNormalMonths || 0);

        // Aggregate Salaries for Display
        byYear[emp.year].totalYouthSalary += (emp.youthSalary || 0);
        byYear[emp.year].totalNormalSalary += (emp.normalSalary || 0);

        byYear[emp.year].totalIntegratedYouthSalary += (emp.integratedYouthSalary || 0);
        byYear[emp.year].totalIntegratedNormalSalary += (emp.integratedNormalSalary || 0);
    });

    // 2. Calculate Averages
    // 사용자 요청: 소수점 3째자리 버림 (절사)
    const truncateTo2Decimals = (num) => Math.floor(num * 100) / 100;

    const sortedYears = Object.keys(byYear).sort().map(Number);
    const annualStats = sortedYears.map(year => {
        const stat = byYear[year];
        
        // 전체 월수
        const totalMonths = stat.totalYouthMonths + stat.totalNormalMonths;

        // 1. 청년 상시근로자 수 = (청년 월수 / 12) 후 소수점 2자리 남기고 버림
        stat.youthCount = truncateTo2Decimals(stat.totalYouthMonths / 12);

        // 2. 청년 외(기타) 상시근로자 수 = (청년 외 월수 / 12) 후 소수점 2자리 남기고 버림
        stat.normalCount = truncateTo2Decimals(stat.totalNormalMonths / 12);
        
        // 3. 전체 상시근로자 수 = 청년 상시근로자 수 + 청년 외 상시근로자 수
        stat.overallCount = Number((stat.youthCount + stat.normalCount).toFixed(2));
        
        // 통합고용용 상시근로자 수 (만 34세 이하)
        stat.integratedYouthCount = truncateTo2Decimals(stat.totalIntegratedYouthMonths / 12);
        stat.integratedNormalCount = truncateTo2Decimals(stat.totalIntegratedNormalMonths / 12);
        
        stat.totalMonths = totalMonths; // UI 표시용 추가

        return stat;
    });

    return annualStats;
}

// Logic A: Employment Increase Credit (Old System - But showing all years)
function calculateCreditAmounts(annualStats, settings) {
    const getRates = (year) => {
        let youthRate = 0;
        let otherRate = 0;

        if (settings.size === 'small') {
            if (settings.region === 'capital') {
                youthRate = 1100;
                otherRate = 700;
            } else {
                if (year === 2021 || year === 2022) {
                    youthRate = 1300;
                } else {
                    youthRate = 1200;
                }
                otherRate = 770;
            }
        } else if (settings.size === 'middle') {
            if (year === 2021 || year === 2022) {
                youthRate = 900;
            } else {
                youthRate = 800;
            }
            otherRate = 450;
        } else {
            // Large
            youthRate = 0;
            otherRate = 0;
        }
        return { youthRate, otherRate };
    };

    return calculateCumulativeCredits(annualStats, (year) => getRates(year).youthRate, (year) => getRates(year).otherRate);
}

// Logic B: Integrated Employment Credit (New System - From 2023)
function calculateIntegratedCredit(annualStats, settings) {
    // Deduction Rates (Unit: 10,000 KRW)
    let youthRate = 0;
    let otherRate = 0;

    if (settings.size === 'small') {
        youthRate = 1450;
        otherRate = 850;
    } else if (settings.size === 'middle') {
        youthRate = 800;
        otherRate = 450;
    } else {
        // Large
        youthRate = 400;
        otherRate = 0;
    }

    // Filter stats to only include 2023 and onwards for *Generation* of credit.
    // However, to calculate increase in 2023, we need 2022 data. 
    // So we pass full history, but we only output results for Year >= 2023.
    
    const integratedStats = annualStats.map(stat => {
        if (stat.year >= 2022 && stat.integratedYouthCount !== undefined) {
            return {
                ...stat,
                youthCount: stat.integratedYouthCount,
                normalCount: stat.integratedNormalCount,
                overallCount: Number((stat.integratedYouthCount + stat.integratedNormalCount).toFixed(2))
            };
        }
        return stat;
    });

    const results = calculateCumulativeCredits(integratedStats, youthRate, otherRate, 2023);
    return results.filter(r => r.year >= 2023);
}

// Shared Helper for Cumulative Calculation (1st, 2nd, 3rd year)
function calculateCumulativeCredits(annualStats, youthRate, otherRate, startYear = null) {
    const initialCredits = {}; // { 2022: { amount: 1000, baseCount: 10.5, youthInc: 1, otherInc: 0 } }
    const calculations = [];
    
    // Step 1: Calculate "Generated Credit" for each year T
    for (let i = 1; i < annualStats.length; i++) {
        const current = annualStats[i];
        const prev = annualStats[i-1];
        
        const diffOverall = Number((current.overallCount - prev.overallCount).toFixed(2));
        const diffYouth = Number((current.youthCount - prev.youthCount).toFixed(2));
        
        let yRate = typeof youthRate === 'function' ? youthRate(current.year) : youthRate;
        let oRate = typeof otherRate === 'function' ? otherRate(current.year) : otherRate;

        let creditAmount = 0;
        let youthIncreaseRecognized = 0;
        let otherIncreaseRecognized = 0;

        if (diffOverall > 0) {
            // Priority to Youth
            if (diffYouth > 0) {
                youthIncreaseRecognized = Math.min(diffOverall, diffYouth);
            } else {
                youthIncreaseRecognized = 0;
            }
            otherIncreaseRecognized = Number((diffOverall - youthIncreaseRecognized).toFixed(2));
            creditAmount = (youthIncreaseRecognized * yRate) + (otherIncreaseRecognized * oRate);
        }

        // Store credit generated in Year T
        if (startYear === null || current.year >= startYear) {
            initialCredits[current.year] = {
                year: current.year,
                creditAmount: Math.floor(creditAmount * 10000), 
                baseOverallCount: prev.overallCount, 
                requiredMaintenanceCount: current.overallCount,
                requiredMaintenanceYouthCount: current.youthCount,
                
                youthIncreaseRecognized,
                otherIncreaseRecognized,
                appliedYouthRate: yRate,
                appliedOtherRate: oRate
            };
        }
    }

    // Step 2: Calculate Receivable Credit for each year T (Summing valid 1st, 2nd, 3rd claims)
    const statsByYear = new Map(annualStats.map(stat => [stat.year, stat]));
    annualStats.forEach(stat => {
        const targetYear = stat.year;
        const currentOverallCount = stat.overallCount;

        // 1. Current Year Generation (1st Year)
        const credit1stObj = initialCredits[targetYear];
        const credit1st = credit1stObj ? credit1stObj.creditAmount : 0;
        
        // 2. Carry Forward from T-1 (2nd Year Payment)
        const prev1Year = targetYear - 1;
        const credit2ndObj = initialCredits[prev1Year];
        let credit2nd = 0;
        if (credit2ndObj && currentOverallCount >= credit2ndObj.requiredMaintenanceCount) {
            let youthDec = Math.max(0, credit2ndObj.requiredMaintenanceYouthCount - stat.youthCount);
            if (youthDec > 0) {
                let effectiveYouth = Math.max(0, credit2ndObj.youthIncreaseRecognized - youthDec);
                let effectiveOther = (credit2ndObj.youthIncreaseRecognized + credit2ndObj.otherIncreaseRecognized) - effectiveYouth;
                let yRate = credit2ndObj.appliedYouthRate;
                let oRate = credit2ndObj.appliedOtherRate;
                credit2nd = Math.floor((effectiveYouth * yRate + effectiveOther * oRate) * 10000);
            } else {
                credit2nd = credit2ndObj.creditAmount;
            }
        }

        // 3. Carry Forward from T-2 (3rd Year Payment)
        const prev2Year = targetYear - 2;
        const credit3rdObj = initialCredits[prev2Year];
        let credit3rd = 0;
        const secondYearStat = statsByYear.get(prev2Year + 1);
        const failedInSecondYear = !!(credit3rdObj && secondYearStat && secondYearStat.overallCount < credit3rdObj.requiredMaintenanceCount);
        if (credit3rdObj && !failedInSecondYear && currentOverallCount >= credit3rdObj.requiredMaintenanceCount) {
            let youthDec = Math.max(0, credit3rdObj.requiredMaintenanceYouthCount - stat.youthCount);
            if (youthDec > 0) {
                let effectiveYouth = Math.max(0, credit3rdObj.youthIncreaseRecognized - youthDec);
                let effectiveOther = (credit3rdObj.youthIncreaseRecognized + credit3rdObj.otherIncreaseRecognized) - effectiveYouth;
                let yRate = credit3rdObj.appliedYouthRate;
                let oRate = credit3rdObj.appliedOtherRate;
                credit3rd = Math.floor((effectiveYouth * yRate + effectiveOther * oRate) * 10000);
            } else {
                credit3rd = credit3rdObj.creditAmount;
            }
        }

        if ((credit1stObj && credit1st > 0) || credit2nd > 0 || credit3rd > 0) {
            
            // Extract details from the *Generation* event (1st year)
            const diffOverall = credit1stObj ? Number((stat.overallCount - credit1stObj.baseOverallCount).toFixed(2)) : 0;
            const youthInc = credit1stObj ? credit1stObj.youthIncreaseRecognized : 0;
            const otherInc = credit1stObj ? credit1stObj.otherIncreaseRecognized : 0;
            
            let actObj = credit1stObj || credit2ndObj || credit3rdObj;
            const yRate = actObj ? actObj.appliedYouthRate : (typeof youthRate === 'function' ? youthRate(targetYear) : youthRate);
            const oRate = actObj ? actObj.appliedOtherRate : (typeof otherRate === 'function' ? otherRate(targetYear) : otherRate);
            
            const totalCredit = credit1st + credit2nd + credit3rd;
            
            if (totalCredit > 0 || diffOverall > 0) { // Only push if there's something relevant
                calculations.push({
                    year: targetYear,
                    diffOverall: diffOverall,
                    youthIncreaseRecognized: youthInc,
                    otherIncreaseRecognized: otherInc,
                    credit1st,
                    credit2nd,
                    credit3rd,
                    totalCredit: totalCredit,
                    youthRate: yRate,
                    otherRate: oRate,
                    calcDetails: `청년등: ${youthInc}명 × ${yRate}만원 + 청년외: ${otherInc}명 × ${oRate}만원`
                });
            }
        }
    });

    return calculations.sort((a,b) => b.year - a.year);
}
