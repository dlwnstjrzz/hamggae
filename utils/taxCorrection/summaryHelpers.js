
/**
 * Aggregates results from different tax credit calculators into a single summary structure.
 * 
 * @param {Object} creditResults - Result from calculateEmploymentIncreaseCredit
 * @param {Object} socialInsuranceResults - Result from calculateSocialInsuranceClaims
 * @param {Object} incomeIncreaseResults - Result from calculateIncomeIncreaseCredit
 * @returns {Object} { years: [], summary: { year: { category: amount } } }
 */
export function aggregateTaxCreditSummary(creditResults, socialInsuranceResults, incomeIncreaseResults) {
    const summary = {};
    const yearsSet = new Set();

    // 1. Employment Increase / Integrated Employment Credit
    if (creditResults && creditResults.results) {
        creditResults.results.forEach(res => {
            const year = res.year;
            yearsSet.add(year);
            if (!summary[year]) summary[year] = {};

            // Determine category based on year
            // 2023 onwards: Integrated Employment Tax Credit (통합고용 세액공제)
            // Before 2023: Employment Increase Tax Credit (고용증대 세액공제)
            const category = year >= 2023 ? 'integratedEmployment' : 'employmentIncrease';
            
            summary[year][category] = res.totalCredit;
        });
    }

    // 2. Social Insurance Credit
    if (socialInsuranceResults && socialInsuranceResults.results) {
        socialInsuranceResults.results.forEach(res => {
            const year = res.year;
            yearsSet.add(year);
            if (!summary[year]) summary[year] = {};
            summary[year]['socialInsurance'] = res.estimatedCredit;
        });
    }

    // 3. Income Increase Credit
    if (incomeIncreaseResults && incomeIncreaseResults.results) {
        incomeIncreaseResults.results.forEach(res => {
            const year = res.year;
            yearsSet.add(year);
            if (!summary[year]) summary[year] = {};
            summary[year]['incomeIncrease'] = res.taxCredit;
        });
    }

    // Sort years descending
    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    
    // Filter to latest 5 years
    const latestYears = sortedYears.slice(0, 5).sort((a,b) => a - b); // Ascending for table display

    // Calculate totals and format for table
    const tableData = latestYears.map(year => {
        const data = summary[year] || {};
        const employmentIncrease = data.employmentIncrease || 0;
        const integratedEmployment = data.integratedEmployment || 0;
        const socialInsurance = data.socialInsurance || 0;
        const incomeIncrease = data.incomeIncrease || 0;
        
        return {
            year,
            employmentIncrease,
            integratedEmployment,
            socialInsurance,
            incomeIncrease,
            total: employmentIncrease + integratedEmployment + socialInsurance + incomeIncrease
        };
    });

    return tableData;
}
