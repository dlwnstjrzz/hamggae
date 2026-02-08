/**
 * Calculates the annual average employee counts and tax credit amounts.
 * @param {Array} employeeData - List of processed employee objects from parseEmployeeData
 * @param {Object} settings - { region: 'capital' | 'non-capital', size: 'small' | 'middle' | 'large' }
 */
export function calculateEmploymentIncreaseCredit(employeeData, settings) {
    const annualAverages = calculateAnnualAverages(employeeData);
    const results = calculateCreditAmounts(annualAverages, settings);
    return { annualAverages, results };
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
                totalYouthSalary: 0,
                totalNormalSalary: 0,
                youthCount: 0,
                normalCount: 0,
                overallCount: 0
            };
        }
        byYear[emp.year].totalYouthMonths += emp.youthMonths;
        byYear[emp.year].totalNormalMonths += emp.normalMonths;

        // Aggregate Salaries for Display
        byYear[emp.year].totalYouthSalary += (emp.youthSalary || 0);
        byYear[emp.year].totalNormalSalary += (emp.normalSalary || 0);
    });

    // 2. Calculate Averages
    // 사용자 요청: 소수점 3째자리 버림 (절사)
    const truncateTo2Decimals = (num) => Math.floor(num * 100) / 100;

    const sortedYears = Object.keys(byYear).sort().map(Number);
    const annualStats = sortedYears.map(year => {
        const stat = byYear[year];
        
        // 전체 월수
        const totalMonths = stat.totalYouthMonths + stat.totalNormalMonths;

        // 1. 전체 상시근로자 수 = (전체 월수 / 12) 후 소수점 2자리 남기고 버림
        stat.overallCount = truncateTo2Decimals(totalMonths / 12);

        // 2. 청년 상시근로자 수 = (청년 월수 / 12) 후 소수점 2자리 남기고 버림
        stat.youthCount = truncateTo2Decimals(stat.totalYouthMonths / 12);

        // 3. 청년 외(기타) 상시근로자 수 = (청년 외 월수 / 12) 후 소수점 2자리 남기고 버림
        // 사용자 요청: 전체 - 청년 방식이 아니라 직접 월수를 합해 계산
        stat.normalCount = truncateTo2Decimals(stat.totalNormalMonths / 12);
        
        stat.totalMonths = totalMonths; // UI 표시용 추가

        return stat;
    });

    return annualStats;
}

function calculateCreditAmounts(annualStats, settings) {
    // Deduction Rates (Unit: 10,000 KRW)
    // Assuming 2021~ rules mostly. 
    // Youth: 1100 (SME/Capital), 1200 (SME/Non-Capital), 800 (Middle), 400 (Large)
    // Others: 700 (SME/Capital), 770 (SME/Non-Capital), 450 (Middle), 0 (Large)
    
    // Simplification for the prototype (User can request precise rate tables later)
    /*
      Small/Medium (SME):
        Capital: Youth 1100, Others 700
        Non-Capital: Youth 1200, Others 770
      Middle:
        All: Youth 800, Others 450
      Large:
        All: Youth 0, Others 0 (Actually some limited support, but usually 0 for this simplified version unless specified)
    */
   
    let youthRate = 0;
    let otherRate = 0;

    if (settings.size === 'small') {
        if (settings.region === 'capital') {
            youthRate = 1100;
            otherRate = 700;
        } else {
            youthRate = 1200;
            otherRate = 770;
        }
    } else if (settings.size === 'middle') {
        youthRate = 800;
        otherRate = 450;
    } else {
        // Large
        youthRate = 0;
        otherRate = 0;
    }

    // 3. Calculate Cumulative Credits (1st + 2nd + 3rd year)
    // We need to store the "Initial Credit Generated" for each year to carry it forward.
    const initialCredits = {}; // { 2022: { amount: 1000, baseCount: 10.5 } }

    const calculations = [];
    
    // We need to iterate through years to determine the credit generated in that specific year (1st year credit)
    // And then for the final "Result Table", we iterate again to sum up eligible credits for that year.
    
    // Step 3a: Calculate "Potentially generated credit" for each year (The 1st year credit)
    // We start from index 1 because we need specific previous year to calculate increase.
    for (let i = 1; i < annualStats.length; i++) {
        const current = annualStats[i];
        const prev = annualStats[i-1];
        
        const diffOverall = Number((current.overallCount - prev.overallCount).toFixed(2));
        const diffYouth = Number((current.youthCount - prev.youthCount).toFixed(2));
        
        let creditAmount = 0;
        let youthIncreaseRecognized = 0;
        let otherIncreaseRecognized = 0;

        if (diffOverall > 0) {
            if (diffYouth > 0) {
                youthIncreaseRecognized = Math.min(diffOverall, diffYouth);
            } else {
                youthIncreaseRecognized = 0;
            }
            otherIncreaseRecognized = Number((diffOverall - youthIncreaseRecognized).toFixed(2));
            creditAmount = (youthIncreaseRecognized * youthRate) + (otherIncreaseRecognized * otherRate);
        }

        initialCredits[current.year] = {
            year: current.year,
            creditAmount: Math.floor(creditAmount * 10000), // Convert to Won
            baseOverallCount: prev.overallCount, // The count we must maintain (Wait, standard is usually maintaining the 'current' count of the inception year? No, strictly it's maintaining the 'Inception' year's count throughout the period. Actually, the rule is: compare Current Year T vs Inception Year T-1. If T < T-1, recapture/reduce.)
            // Simplified Maintenance Rule for 2nd/3rd year payment condition: 
            // To receive 2nd year payment in (Y+1): Count(Y+1) >= Count(Y). (Wait, usually it's maintaining the 'increased' state. So Count(Y+1) >= Count(Y-1)? No, the baseline is the year OF increase. i.e. Y.)
            // Let's assume: Credit generated in Y. Condition to get it in Y+1 is: OverallCount(Y+1) >= OverallCount(Y).
            requiredMaintenanceCount: current.overallCount,
            youthIncreaseRecognized, // Add these for UI
            otherIncreaseRecognized
        };
    }

    // Step 3b: Calculate Total Receivable Credit for each year (Summing 1st, 2nd, 3rd)
    
    annualStats.forEach(stat => {
        const targetYear = stat.year;
        const currentOverallCount = stat.overallCount;

        // 1. 1st Year Credit
        const credit1stObj = initialCredits[targetYear];
        const credit1st = credit1stObj ? credit1stObj.creditAmount : 0;
        
        // 2. 2nd Year
        const prev1Year = targetYear - 1;
        const credit2ndObj = initialCredits[prev1Year];
        let credit2nd = 0;
        if (credit2ndObj && currentOverallCount >= credit2ndObj.requiredMaintenanceCount) {
            credit2nd = credit2ndObj.creditAmount;
        }

        // 3. 3rd Year
        const prev2Year = targetYear - 2;
        const credit3rdObj = initialCredits[prev2Year];
        let credit3rd = 0;
        if (credit3rdObj && currentOverallCount >= credit3rdObj.requiredMaintenanceCount) {
            credit3rd = credit3rdObj.creditAmount;
        }

        if (initialCredits[targetYear] || credit2nd > 0 || credit3rd > 0) {
            
            // Extract values for reuse in calcDetails
            const diffOverall = credit1stObj ? Number((stat.overallCount - credit1stObj.baseOverallCount).toFixed(2)) : 0;
            const youthInc = credit1stObj ? credit1stObj.youthIncreaseRecognized : 0;
            const otherInc = credit1stObj ? credit1stObj.otherIncreaseRecognized : 0;
            
            calculations.push({
                year: targetYear,
                diffOverall: diffOverall,
                youthIncreaseRecognized: youthInc,
                otherIncreaseRecognized: otherInc,
                credit1st,
                credit2nd,
                credit3rd,
                totalCredit: credit1st + credit2nd + credit3rd,
                // Add rates for display
                youthRate,
                otherRate,
                calcDetails: `청년: ${youthInc}명 × ${youthRate}만원 + 청년외: ${otherInc}명 × ${otherRate}만원`
            });
        }
    });

    return calculations.sort((a,b) => b.year - a.year); // Descending
}
