import { getSocialInsuranceRate } from './socialInsuranceRates';

/**
 * Calculates the Social Insurance Tax Deduction.
 * @param {Array} employeeData - List of processed employee objects from parseEmployeeData
 * @param {Object} settings - { isNewGrowth: boolean (default false) }
 */
export function calculateSocialInsuranceClaims(employeeData, settings = { isNewGrowth: false }) {
    const annualStats = calculateAnnualStats(employeeData);
    const results = calculateCreditAmounts(annualStats, settings);
    return { annualStats, results };
}

function calculateAnnualStats(employeeData) {
    // 1. Group by Year
    const byYear = {};
    employeeData.forEach(emp => {
        if (!byYear[emp.year]) {
            byYear[emp.year] = { 
                year: emp.year, 
                totalYouthMonths: 0, 
                totalNormalMonths: 0,
                // Social Insurance Salaries
                siTotalSalary: 0,
                siYouthSalary: 0,
                siNormalSalary: 0,
                
                youthCount: 0,
                normalCount: 0,
                overallCount: 0
            };
        }
        byYear[emp.year].totalYouthMonths += emp.youthMonths;
        byYear[emp.year].totalNormalMonths += emp.normalMonths;
        
        // Summing up the specific salaries for Social Insurance calculation
        byYear[emp.year].siTotalSalary += (emp.socialInsuranceTotalSalary || 0);
        byYear[emp.year].siYouthSalary += (emp.socialInsuranceYouthSalary || 0);
        byYear[emp.year].siNormalSalary += (emp.socialInsuranceNormalSalary || 0);
    });

    // 2. Calculate Averages
    const truncateTo2Decimals = (num) => Math.floor(num * 100) / 100;

    const sortedYears = Object.keys(byYear).sort().map(Number);
    const annualStats = sortedYears.map(year => {
        const stat = byYear[year];
        
        const totalMonths = stat.totalYouthMonths + stat.totalNormalMonths;

        // 1. Overall Constant Employee Count
        stat.overallCount = truncateTo2Decimals(totalMonths / 12);

        // 2. Youth Constant Employee Count
        stat.youthCount = truncateTo2Decimals(stat.totalYouthMonths / 12);

        // 3. Normal (Non-Youth) Constant Employee Count
        stat.normalCount = truncateTo2Decimals(stat.totalNormalMonths / 12);

        return stat;
    });

    return annualStats;
}

function calculateCreditAmounts(annualStats, settings) {
    const calculations = [];
    const deductionFactor = settings.isNewGrowth ? 0.75 : 0.5;

    // We store "New Credits" generated in each year to track for 2nd year support
    const creditHistory = {}; 

    for (let i = 1; i < annualStats.length; i++) {
        const current = annualStats[i];
        const prev = annualStats[i-1];
        const year = current.year;
        
        const rateInfo = getSocialInsuranceRate(year);
        const insuranceRate = rateInfo.total;

        // --- 1. Calculate Increases ---
        const diffOverall = Number((current.overallCount - prev.overallCount).toFixed(2));
        const diffYouth = Number((current.youthCount - prev.youthCount).toFixed(2));
        
        // Logic: Valid Youth Increase <= Total Increase
        // If Total Increase is negative, no new credit.
        let recognizedYouthIncrease = 0;
        let recognizedNormalIncrease = 0;

        if (diffOverall > 0) {
            // Youth Increase Recognition
            if (diffYouth > 0) {
                recognizedYouthIncrease = Math.min(diffYouth, diffOverall);
            } else {
                recognizedYouthIncrease = 0;
            }

            // Normal Increase = Total Increase - Recognized Youth Increase
            recognizedNormalIncrease = Number((diffOverall - recognizedYouthIncrease).toFixed(2));
        }

        // --- 2. Calculate Burden Per Person & Deduction Amounts ---
        
        // A. Youth
        let youthBurdenPerPerson = 0;
        if (current.youthCount > 0) {
            youthBurdenPerPerson = (current.siYouthSalary / current.youthCount) * insuranceRate;
        }
        const youthCredit = Math.floor(recognizedYouthIncrease * youthBurdenPerPerson);

        // B. Normal (Non-Youth)
        // Note: Denominator for Burden is 'Normal Count' of Current Year?
        // Image Item 29 says: "Current Year Normal Count (Item 29)".
        // Item 28: "Current Year Normal Salary".
        let normalBurdenPerPerson = 0;
        
        // Wait, strictly speaking, "Normal Count" in image Item 29 is "Overall(23) - Youth(29->8? Item 8)".
        // My stat.normalCount is derived from totalNormalMonths.
        // Let's verify: Overall = Youth + Normal.
        // Is (Overall - Youth) == Normal?
        // Since we floored everything, (Overall - Youth) might slightly differ from Normal floored directly.
        // The image Item 29 says explicitly "Item 23 - Item 8".
        // Item 23 is Overall Count. Item 8 is Youth Count.
        // So I should use (current.overallCount - current.youthCount) as the divisor to match the image formula exactly.
        const derivedNormalCount = Number((current.overallCount - current.youthCount).toFixed(2));

        if (derivedNormalCount > 0) {
            normalBurdenPerPerson = (current.siNormalSalary / derivedNormalCount) * insuranceRate;
        }
        const normalCredit = Math.floor(recognizedNormalIncrease * normalBurdenPerPerson * deductionFactor);

        const totalYearlyCredit = youthCredit + normalCredit;

        // Store for history (to calculate 2nd year support next year)
        creditHistory[year] = {
            year,
            baseOverallCount: prev.overallCount, // The baseline to maintain
            // For 2nd year, we need to know how much credit was generated to potentially give it again.
            // But wait, 2nd year support is usually "Give the same amount again if maintained".
            youthCreditGenerated: youthCredit,
            normalCreditGenerated: normalCredit,
            totalGenerated: totalYearlyCredit
        };

        // --- 3. Calculate 2nd Year Support (from Previous Year's generation) ---
        let support2ndYear = 0;
        const prevYear = year - 1;
        const prevHistory = creditHistory[prevYear];

        if (prevHistory && prevHistory.totalGenerated > 0) {
            // Condition: Current Overall Count >= Previous Overall Count (Item 34)
            // Image Item 33: Current Overall (2nd Year)
            // Item 34: 1st Year (Previous Year) Overall Count. 
            // WAIT. The image Item 34 says "1st Year (Previous Tax Year) Constant Employee Count".
            // And Item 35 is Increase. (33 - 34).
            // Condition for support: Item 35 >= 0.
            
            // Note: The "Base" for the credit generation was (Year-1). 
            // The "Count" at the time of generation was (Year).
            // The condition to receive it AGAIN in (Year+1) is Count(Year+1) >= Count(Year).
            
            // Let's re-read Image 3. "2nd Year Tax Support Requirements".
            // Item 33: 2nd Year (Current) Count.
            // Item 34: 1st Year (Previous) Count.
            // Be careful with "1st Year". Does it mean the year credit was generated? Yes.
            // So we compare Current Count vs Count of the Year it was generated.
            
            // In my loop:
            // `prevHistory` was generated in `prevYear`.
            // The count in `prevYear` was `annualStats[i-1].overallCount`.
            // So we check: `current.overallCount` >= `annualStats[i-1].overallCount`.
            
            // Wait, careful with indexing. 
            // `prev` variable in my loop is `annualStats[i-1]` which is `year-1`.
            // So yes, we compare `current.overallCount` >= `prev.overallCount`.
            
            if (current.overallCount >= prev.overallCount) {
                support2ndYear = prevHistory.totalGenerated;
            }
        }

        if (totalYearlyCredit > 0 || support2ndYear > 0) {
            calculations.push({
                year,
                overallCount: current.overallCount,
                prevOverallCount: prev.overallCount,
                youthCount: current.youthCount,
                prevYouthCount: prev.youthCount,
                
                diffOverall,
                diffYouth,
                
                // Mapped for Frontend
                youthIncrease: recognizedYouthIncrease,
                normalIncrease: recognizedNormalIncrease,
                targetIncrease: recognizedYouthIncrease + recognizedNormalIncrease,
                
                youthBurdenPerPerson: Math.floor(youthBurdenPerPerson),
                normalBurdenPerPerson: Math.floor(normalBurdenPerPerson),
                
                youthCredit,
                normalCredit,
                support2ndYear,
                
                estimatedCredit: totalYearlyCredit + support2ndYear
            });
        }
    }

    return calculations.sort((a,b) => b.year - a.year);
}
