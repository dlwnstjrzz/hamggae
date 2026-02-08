
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
    
    // Helper: Calculate FTE (Full Time Equivalent) for a list of employees in a specific year
    // FTE = Sum of Working Months / 12
    const calculateStats = (employees, year) => {
        let totalWages = 0;
        let totalAnnualizedWages = 0;
        let totalMonths = 0;
        let count = 0;

        employees.forEach(emp => {
            totalWages += emp.totalSalary;
            const workingMonths = calculateWorkingMonths(emp, year);
            totalMonths += workingMonths;
            count++;

            // User Requirement: Annualize wage for calculating average wage
            // If worked 6 months (0.5 FTE), Annualized = Wage * 2
            if (workingMonths > 0) {
                totalAnnualizedWages += emp.totalSalary * (12 / workingMonths);
            }
        });

        return {
            totalWages,
            totalAnnualizedWages,
            fte: Math.floor((totalMonths / 12) * 100) / 100, // Truncate below 2nd decimal
            count
        };
    };

    // Helper to compare employees handling masked IDs
    const isSamePerson = (p1, p2) => {
        if (!p1.name || !p2.name || p1.name !== p2.name) return false;
        if (!p1.id || !p2.id) return false;
        if (p1.id === p2.id) return true;
        
        // Compare front 6 digits
        const id1 = p1.id.replace(/-/g, '').substring(0, 6);
        const id2 = p2.id.replace(/-/g, '').substring(0, 6);
        return id1 === id2;
    };

    // Helper to determine accurate exclusion status
    const getExclusionStatus = (emp, targetYear) => {
        // 1. Must be employed at Year End of Target Year
        if (!isEmployedAtYearEnd(emp, targetYear)) {
            return { isExcluded: true, reason: '연말 기준 미재직' };
        }

        const empId = emp.id;
        if (!empId) return { isExcluded: true, reason: '식별 불가 (주민번호 미기재)' };



        // 3. Check Resignation History FIRST (TargetYear-4 ~ TargetYear)
        for (let y = targetYear; y >= targetYear - 4; y--) {
            // Find ALL matching records (handle split rows or masked IDs)
            const matchingRecords = (dataByYear[y] || []).filter(d => isSamePerson(d, emp));
            
            // Check for ANY resignation in this year
            const resignedRecord = matchingRecords.find(d => {
                if (d.retireDate) {
                    const rDate = new Date(d.retireDate);
                    return rDate.getFullYear() === y;
                }
                return false;
            });

            if (resignedRecord) {
                 return { isExcluded: true, reason: '5년 내 퇴사이력', retireDate: resignedRecord.retireDate };
            }
        }

        // 3. Check High Salary (Sum of all records in a year > 70m)
        for (let y = targetYear; y >= targetYear - 4; y--) {
            const matchingRecords = (dataByYear[y] || []).filter(d => isSamePerson(d, emp));
            const yearTotalSalary = matchingRecords.reduce((sum, d) => sum + d.totalSalary, 0);

            if (yearTotalSalary > 70000000) {
                return { isExcluded: true, reason: '5년 내 연봉 7천 이상' };
            }
        }

        return { isExcluded: false, reason: '' };
    };

    // Note: We do NOT calculate a global 'annualStats' anymore.
    // We calculate stats dynamically for each Target Year context.

    // Main Loop: Calculate Credit for each year T
    years.forEach(targetYear => {
        // Relaxed check: We need at least T-1 data to calculate current growth (Rate T).
        // For past rates (T-1, T-2, T-3), if data is missing, we treat growth as 0% based on user preference to average over 3 years.
        const hasFullHistory = (dataByYear[targetYear - 1] !== undefined);

        const cohortEmployees = [];
        const excludedList = []; 
        const currentYearEmployees = dataByYear[targetYear] || [];

        // 1. Define Cohort: The "Sangsi" workers of Target Year who survived the 5-year check
        currentYearEmployees.forEach(emp => {
            const status = getExclusionStatus(emp, targetYear);
            
            if (!status.isExcluded) {
                cohortEmployees.push(emp);
            } else {
                excludedList.push({ name: emp.name, id: emp.id, reason: status.reason, year: targetYear, retireDate: status.retireDate });
            }
        });

        // 2. Calculate Avg Wages and FTE for THIS Cohort across T, T-1, T-2...
        // The stats for T-1 must be based on THIS Cohort (filtered by T's exclusion rules).
        const yearlyStats = {};
        const checkYears = [0, 1, 2, 3, 4].map(delta => targetYear - delta);
        
        checkYears.forEach(y => {
            const empDataList = [];
            // Find data for this cohort in year y
            cohortEmployees.forEach(c => {
                 // Use isSamePerson to find the historical record(s)
                 const matches = (dataByYear[y] || []).filter(d => isSamePerson(d, c));
                 empDataList.push(...matches);
            });
            
            // 1. Standard Wage (Includes everyone in cohort)
            const validForWageStd = empDataList;

            // Calculate Excluded (All employees in Year Y - Included Cohort Members)
            const allInYear = dataByYear[y] || [];
            const includedIds = new Set(validForWageStd.map(e => e.id));
            const excludedInYear = allInYear.filter(e => !includedIds.has(e.id)).map(e => {
                // Check if they were excluded in Target Year (found in excludedList)
                const exclusionRecord = excludedList.find(ex => isSamePerson(ex, e));
                let reason = exclusionRecord ? exclusionRecord.reason : '연말 기준 미재직';
                
                // Unconditionally find the latest retireDate from ANY year history for this person
                let displayRetireDate = e.retireDate || (exclusionRecord ? exclusionRecord.retireDate : null);

                if (!displayRetireDate) {
                    // Exhaustive search in all years
                    const allYears = Object.keys(dataByYear).sort((a,b) => b-a); // Search recent first
                    for (const yearKey of allYears) {
                        const found = dataByYear[yearKey].find(d => isSamePerson(d, e));
                        if (found && found.retireDate) {
                            displayRetireDate = found.retireDate;
                            break;
                        }
                    }
                }

                if (!exclusionRecord) {
                    // Not in Target Year (e.g. resigned before). derive reason
                    if (e.totalSalary > 70000000) reason = '5년 내 연봉 7천 이상';
                    else if (displayRetireDate) reason = '5년 내 퇴사이력'; 
                }
                
                return {
                    ...e,
                    reason: reason,
                    retireDate: displayRetireDate
                };
            });

            // 2. Excluded New Hires Wage (Excludes hires in year Y)
            // Logic: HireDate < Y-01-01
            const validForWageExcl = empDataList.filter(e => {
                if (!e.hireDate) return false;
                // String comparison for robustness against timezone
                const yearStartStr = `${y}-01-01`;
                return e.hireDate < yearStartStr;
            });

            // Calculate Stats
            const wageStatsStd = calculateStats(validForWageStd, y);
            const wageStatsExcl = calculateStats(validForWageExcl, y);
            const basicStats = calculateStats(empDataList, y); // For FTE (Always Standard for FTE?)
            
            // Determine wage source based on year (User Requirement)
            // 2023 onwards: Use Actual Total Wages (No annualization)
            // Up to 2022: Use Annualized Wages
            const useActualWages = y >= 2023;
            const getWageSum = (stats) => useActualWages ? stats.totalWages : stats.totalAnnualizedWages;

            yearlyStats[y] = {
                avgWage: (wageStatsStd.count > 0 && wageStatsStd.fte > 0) ? (getWageSum(wageStatsStd) / wageStatsStd.fte) : 0,
                avgWageExcl: (wageStatsExcl.count > 0 && wageStatsExcl.fte > 0) ? (getWageSum(wageStatsExcl) / wageStatsExcl.fte) : 0,
                fte: Math.floor(basicStats.fte * 100) / 100,
                totalWages: wageStatsStd.totalWages, // For display
                count: basicStats.count, // For display
                names: [...new Set(validForWageStd.map(e => e.name))].sort(),
                includedEmployees: validForWageStd, // Full objects for "Included" table
                excludedEmployees: excludedInYear   // Full objects for "Excluded" table
            };
        });

        // 3. Calculate Rates
        // Formula: Growth Rate(Y) = (AvgWage(Y, Excl New Hires) - AvgWage(Y-1, Standard)) / AvgWage(Y-1, Standard)
        const getRate = (curExcl, prevStd) => {
            if (!prevStd || prevStd <= 0) return null; // Avoid division by zero
            return (curExcl - prevStd) / prevStd;
        };

        // Standard Wages (for Denominators and Excess Calc)
        const wageT = yearlyStats[targetYear]?.avgWage || 0;
        const wageT_1 = yearlyStats[targetYear-1]?.avgWage || 0;
        const wageT_2 = yearlyStats[targetYear-2]?.avgWage || 0;
        const wageT_3 = yearlyStats[targetYear-3]?.avgWage || 0;
        const wageT_4 = yearlyStats[targetYear-4]?.avgWage || 0;

        // Excluded Wages (for Numerators)
        const wageT_Excl = yearlyStats[targetYear]?.avgWageExcl || 0;
        const wageT_1_Excl = yearlyStats[targetYear-1]?.avgWageExcl || 0;
        const wageT_2_Excl = yearlyStats[targetYear-2]?.avgWageExcl || 0;
        const wageT_3_Excl = yearlyStats[targetYear-3]?.avgWageExcl || 0;

        // Rates mixing Excl (Current) vs Std (Prev)
        const rateT = getRate(wageT_Excl, wageT_1);       // T Growth = (T_Excl - T-1_Std) / T-1_Std
        const rateT_1 = getRate(wageT_1_Excl, wageT_2);   // T-1 Growth = (T-1_Excl - T-2_Std) / T-2_Std
        const rateT_2 = getRate(wageT_2_Excl, wageT_3);   // T-2 Growth
        const rateT_3 = getRate(wageT_3_Excl, wageT_4);   // T-3 Growth

        const ratesLast3Years = [];
        // User Logic: Treat undefined/null rates as 0% and always divide by 3 (average over 3 years)
        ratesLast3Years.push(rateT_1 !== null ? rateT_1 : 0);
        ratesLast3Years.push(rateT_2 !== null ? rateT_2 : 0);
        ratesLast3Years.push(rateT_3 !== null ? rateT_3 : 0);

        // Inject rates into history for UI display
        if (yearlyStats[targetYear]) yearlyStats[targetYear].growthRate = rateT;
        if (yearlyStats[targetYear-1]) yearlyStats[targetYear-1].growthRate = rateT_1;
        if (yearlyStats[targetYear-2]) yearlyStats[targetYear-2].growthRate = rateT_2;
        if (yearlyStats[targetYear-3]) yearlyStats[targetYear-3].growthRate = rateT_3;

        let avgRateLast3Years = 0;
        if (ratesLast3Years.length > 0) {
             avgRateLast3Years = ratesLast3Years.reduce((a,b) => a+b, 0) / ratesLast3Years.length;
        }

        // 4. Calculate Credit
        let excessAmount = 0;
        let creditAmount = 0;
        let calculationMethod = 'general'; // 'general', 'special', 'sme'
        const employeeCountPre = yearlyStats[targetYear-1]?.fte || 0;
        const employeeCountCurr = yearlyStats[targetYear]?.fte || 0;

        // Decision: General vs Special Provision (상호 배타적)
        // General Rule requires: RateT-1 > 0 AND RateT-1 >= 30% of AvgRate3Yr
        // Special Provision applies if: RateT-1 < 0 OR RateT-1 < 30% of AvgRate3Yr
        
        let excessGeneral = 0;
        let isGeneralApplicable = false;
        let generalDesc = '';

        let excessSpecial = 0;
        let isSpecialApplicable = false;
        let specialDesc = '';
        
        let useSpecialProvision = false;
        
        // Check triggers using RateT_1 (Previous Year Growth)
        // Screenshot Step 7 Title references (28), which is RateT-1.
        // Logic: If previous year growth was negative or very low (dip), we smooth T and T-1.
        if (wageT_2 > 0 && rateT_1 !== null) {
             const conditionNegative = rateT_1 < 0;
             const conditionLowGrowth = (rateT_1 >= 0 && avgRateLast3Years > 0 && rateT_1 < 0.3 * avgRateLast3Years);
             
             if (conditionNegative || conditionLowGrowth) {
                 useSpecialProvision = true;
             }
        }

        if (useSpecialProvision) {
            // Method B: Special Provision (계산 특례)
             if (hasFullHistory && wageT_2 > 0) {
                // Step 33: Modified Avg Wage T = (WageT + WageT-1) / 2
                const wageSpecT = (wageT + wageT_1) / 2;
                
                // Step 35: Modified Avg Rate = (RateT-2 + RateT-3) / 2
                const r2 = rateT_2 !== null ? rateT_2 : 0;
                const r3 = rateT_3 !== null ? rateT_3 : 0;
                const avgRateSpecPrev = (r2 + r3) / 2;

                // Step 36: Excess = (WageSpecT - WageT-2 * (1 + AvgRateSpecPrev)) * CountT-1
                const wageIfGrewSpec = wageT_2 * (1 + avgRateSpecPrev);
                const diffSpec = wageSpecT - wageIfGrewSpec;
                const resultSpec = diffSpec * employeeCountPre;
                
                // Always generate description to show details even if result is zero/negative
                specialDesc = `계산특례: { (당해[${wageT.toLocaleString(undefined, {maximumFractionDigits:0})}] + 직전[${wageT_1.toLocaleString(undefined, {maximumFractionDigits:0})}]) / 2 - 직전2년[${wageT_2.toLocaleString(undefined, {maximumFractionDigits:0})}] × (1 + 특례율[${(avgRateSpecPrev*100).toFixed(2)}%]) } × 직전인원[${employeeCountPre}] = ${resultSpec.toLocaleString(undefined, {maximumFractionDigits:0})}`;

                if (diffSpec > 0) {
                    excessSpecial = resultSpec;
                }
                isSpecialApplicable = true; // Marked as applicable because it was triggered
             }
        } else {
             // Method A: General Calculation (일반적인 경우)
             if (hasFullHistory && rateT !== null && rateT > avgRateLast3Years && avgRateLast3Years >= 0) {
                 const wageIfGrew = wageT_1 * (1 + avgRateLast3Years);
                 const diff = wageT - wageIfGrew;
                 if (diff > 0) {
                     excessGeneral = diff * employeeCountPre;
                     isGeneralApplicable = true;
                     generalDesc = `일반계산: (${wageT.toLocaleString(undefined, {maximumFractionDigits:0})} - ${wageT_1.toLocaleString(undefined, {maximumFractionDigits:0})} × (1 + ${(avgRateLast3Years*100).toFixed(2)}%)) × ${employeeCountPre}`;
                 }
             }
        }

        // Method C: SME Provision (중소기업 특례 - 연도별 상이)
        // Trigger: SME, RateT > FixedRate, CountT >= CountT-1, RateT-1 >= 0
        let excessSME = 0;
        let isSMEApplicable = false;
        let smeDesc = '';
        
        // Year-specific fixed rates provided by user
        const smeFixedRates = {
            2020: 0.038, // 3.8%
            2021: 0.038, // 3.8%
            2022: 0.030, // 3.0%
            2023: 0.032, // 3.2%
            2024: 0.032  // 3.2%
        };
        const yInt = parseInt(targetYear);
        const fixedRate = smeFixedRates[yInt] || 0.03; // Default 3.0% if not mapped

        // Generate SME Requirement Details for all years (Display purpose)
        // Treat null/undefined as 0 (0.00%) as per user request to handle missing data or start of data.
        const rT = (rateT !== null && rateT !== undefined) ? rateT : 0;
        const rT1 = (rateT_1 !== null && rateT_1 !== undefined) ? rateT_1 : 0;
        
        const rateTPct = (rT * 100).toFixed(2);
        const rateT1Pct = (rT1 * 100).toFixed(2);
        const fixedRatePct = (fixedRate * 100).toFixed(1);
        
        const rateTRounded = parseFloat(rateTPct); 
        const rateT1Rounded = parseFloat(rateT1Pct);
        const fixedRateVal = parseFloat(fixedRatePct);
        
        // Also used for display later
        const isCond1Met = rateTRounded > fixedRateVal;
        const isCond2Met = employeeCountCurr >= employeeCountPre;
        const isCond3Met = rateT1Rounded >= 0;

        const smeRequirementsDesc = `[중소요건] ①증가율(${rateTPct}%) ${isCond1Met ? '>' : '≤'} ${fixedRatePct}%, ②인원(${employeeCountCurr}) ${isCond2Met ? '≥' : '<'} ${employeeCountPre}, ③직전증가율(${rateT1Pct}%) ${isCond3Met ? '≥' : '<'} 0`;

        // Default to small if not specified or explicit 'small'
        const isSmall = !settings.size || settings.size === 'small';

        // Check strictly for Conditions (Calculation Amount is separate)
        let isSMEConditionsMet = false;
        let smeReason = [];

        if (isSmall) {
            isSMEConditionsMet = isCond1Met && isCond2Met && isCond3Met;
            
            if (!isSMEConditionsMet) {
                if (!isCond1Met) smeReason.push(`증가율(${rateTPct}%)이 고시율(${fixedRatePct}%) 이하`);
                if (!isCond2Met) smeReason.push(`상시근로자 수 감소`);
                if (!isCond3Met) smeReason.push(`직전년도 임금증가율(${rateT1Pct}%) 음수`);
            }

            if (isSMEConditionsMet) {
                // Step 37: Excess = (WageT - WageT-1 * (1 + FixedRate)) * CountT-1
                // WageT and WageT-1 use Standard calculations (Step 15, 16) per Step 37 rules.
                const wageIfGrewSME = wageT_1 * (1 + fixedRate);
                const diffSME = wageT - wageIfGrewSME;
                
                if (diffSME > 0) {
                    excessSME = diffSME * employeeCountPre;
                    // isSMEApplicable was used for "calculated amount > 0" in previous logic, 
                    // but usually 'applicable' means requirements met. 
                    // We will separate them in the result object.
                    isSMEApplicable = true; 
                    smeDesc = `중소기업특례: (${wageT.toLocaleString(undefined, {maximumFractionDigits:0})} - ${wageT_1.toLocaleString(undefined, {maximumFractionDigits:0})} × (1 + ${(fixedRate*100).toFixed(1)}%)) × ${employeeCountPre}`;
                }
            }
        } else {
             smeReason.push('중소기업 아님');
        }

        // --- Tax Credit Amount Calculation (Restored) ---
        // Determine rate based on size
        let potentialRate = 0.05;
        if (settings.size === 'middle') potentialRate = 0.10;
        else if (settings.size === 'small' || !settings.size) potentialRate = 0.20; 

        const calcCredit = (excess) => excess > 0 ? Math.floor(excess * potentialRate) : 0;

        // Determine Final Excess Amount (Max of applicable methods)
        // Also prepare detailed breakdown for UI display (Formula + Value Substitution)
        const allCalculations = [];
        
        // Formulas (Symbolic)
        const formulas = {
            general: '(당해연도 총급여 - 직전연도 총급여 × (1 + 직전 3년 평균임금증가율)) × 직전연도 전체 상시근로자 수',
            special: '{ (당해연도 총급여 + 직전연도 총급여) / 2 - 직전 2년 총급여 × (1 + 직전 2년 특례증가율) } × 직전연도 전체 상시근로자 수',
            sme: '(당해연도 총급여 - 직전연도 총급여 × (1 + 중소기업 고시이자율)) × 직전연도 전체 상시근로자 수'
        };

        // Helper to strip label from desc
        const stripLabel = (d) => d.includes(':') ? d.substring(d.indexOf(':') + 1).trim() : d;

        if (isGeneralApplicable) {
            allCalculations.push({ 
                method: 'general', 
                label: '일반계산', 
                formula: formulas.general, 
                desc: stripLabel(generalDesc), 
                amount: excessGeneral,
                credit: calcCredit(excessGeneral) 
            });
        }
        if (isSpecialApplicable) {
            allCalculations.push({ 
                method: 'special', 
                label: '계산특례', 
                formula: formulas.special, 
                desc: stripLabel(specialDesc), 
                amount: excessSpecial,
                credit: calcCredit(excessSpecial)
            });
        }
        if (isSMEApplicable) {
            allCalculations.push({ 
                method: 'sme', 
                label: '중소특례', 
                formula: formulas.sme, 
                desc: stripLabel(smeDesc), 
                amount: excessSME,
                credit: calcCredit(excessSME)
            });
        }
        
        
        let calcDetails = '';
        // Sort by amount desc to determine winner
        if (allCalculations.length > 0) {
            allCalculations.sort((a,b) => b.amount - a.amount);
            excessAmount = allCalculations[0].amount;
            calculationMethod = allCalculations[0].method;
            calcDetails = allCalculations[0].desc; // Legacy support
        }

        // --- Structured Conditions Reuse logic (Variables are already defined above) ---
        // smeConditions, generalConditions, specialConditions are defined above.
        // Restoring definitions here because they were missing in scope
        
        // 1. SME
        const smeConditions = [];
        if (settings.size === 'small' || !settings.size) {
             smeConditions.push({
                label: '①증가율',
                val: `${rateTPct}%`,
                op: '>',
                target: `${fixedRatePct}%`,
                isMet: isCond1Met
            });
            smeConditions.push({
                 label: '②인원',
                 val: `${employeeCountCurr}`,
                 op: '≥',
                 target: `${employeeCountPre}`,
                 isMet: isCond2Met
            });
            smeConditions.push({
                 label: '③직전증가율',
                 val: `${rateT1Pct}%`,
                 op: '≥',
                 target: '0%',
                 isMet: isCond3Met
            });
        }

        // 2. General
        const generalConditions = [];
        const avgRateVal = typeof avgRateLast3Years !== 'undefined' ? avgRateLast3Years : 0;
        generalConditions.push({
            label: '①증가율',
            val: `${(rateT * 100).toFixed(2)}%`,
            op: '>',
            target: `${(avgRateVal * 100).toFixed(2)}%`,
            isMet: excessGeneral > 0 
        });

        // 3. Special
        const specialConditions = [];
        if (useSpecialProvision) {
             const cond1 = (rateT_1 < 0);
             const cond2 = (rateT_1 >= 0 && avgRateVal > 0 && rateT_1 < 0.3 * avgRateVal);
             
             if (cond1) {
                  specialConditions.push({
                      label: '①직전증가율',
                      val: `${rateT1Pct}%`,
                      op: '<',
                      target: '0%',
                      isMet: true
                  });
             } else if (cond2) {
                 const targetPct = (0.3 * avgRateVal * 100).toFixed(2);
                 specialConditions.push({
                      label: '①직전증가율',
                      val: `${rateT1Pct}%`,
                      op: '<',
                      target: `${targetPct}% (30%평균)`,
                      isMet: true
                  });
             }
        }


        // Define credits for use in failure logic logic and final results (Re-introduced)
        const creditGeneral = calcCredit(excessGeneral);
        const creditSpecial = calcCredit(excessSpecial);
        const creditSME = calcCredit(excessSME);

        // --- Failure Remarks Logic (Only for Remark Column) ---
        let failureNote = '';
        
        if (excessAmount <= 0) {
             const notes = [];
             let curReason = '';
             let altReason = '';
             // Simplified context
             const contextMethodName = useSpecialProvision ? '계산특례' : '일반계산';
             const contextReason = useSpecialProvision 
                ? (creditSpecial <= 0 ? '증가율 미달/음수' : '') 
                : (creditGeneral <= 0 ? (rateT > avgRateLast3Years ? '증가율 미달(계산액 음수)' : '증가율 미달') : '');

             const smeName = '중소특례';
             let smeReasonText = '';
             if (settings.size === 'small' || !settings.size) { 
                 if (!isSMEConditionsMet) smeReasonText = '요건 미충족';
                 else if (creditSME <= 0) smeReasonText = '계산액 없음(음수)';
             } else {
                 smeReasonText = '대상 아님(비중소)';
             }

             if (calculationMethod === 'sme') {
                 if (!isSMEConditionsMet) curReason = '요건 미충족';
                 else curReason = '계산액 없음';
                 altReason = contextReason;
             } else {
                 curReason = contextReason || '증가율 미달';
                 altReason = smeReasonText;
             }
             
            // Show both in failure note
            const parts = [];
            parts.push(`${calculationMethod === 'sme' ? '중소특례' : contextMethodName}: ${curReason}`);
            // Only show alt reason if relevant (e.g. SME failed too)
            if (altReason) parts.push(`${calculationMethod === 'sme' ? contextMethodName : smeName}: ${altReason}`);
            failureNote = parts.join(' / ');
        }
        
        // Final Tax Credit Calculation
        const finalCredit = calcCredit(excessAmount);

        results.push({
            year: targetYear,
            excessAmount: excessAmount, // Tax Base
            taxCredit: finalCredit,
            
            // Debug/View Props
            excessGeneral: excessGeneral,
            creditGeneral: calcCredit(excessGeneral),
            
            excessSME: excessSME,
            creditSME: calcCredit(excessSME),
            
            isSMEApplicable: isSMEApplicable, 
            smeConditions: smeConditions, 
            smeConditionsMet: isSMEConditionsMet,
            generalConditions: generalConditions,
            specialConditions: specialConditions,

            isCreditCalculable: hasFullHistory,
            history: yearlyStats, 
            calcDetails: calcDetails, // Keep for backward compat
            calculationMethod: calculationMethod, 
            
            allCalculations: allCalculations, // New structured details
            
            failureNote: failureNote,
            // comparisonResult removed
            
            cohortCount: cohortEmployees.length, 
            includedEmployees: cohortEmployees, 
            excludedEmployees: excludedList, 
            avgWageT: wageT,
            avgWageT_1: wageT_1,
            rateT: rateT !== null ? rateT : 0,
            rates: { t1: rateT_1, t2: rateT_2, t3: rateT_3 },
            prevRates: ratesLast3Years,
            avgPrevRate: avgRateLast3Years,
            employeeCountPre: employeeCountPre,
            employeeCountCurr: employeeCountCurr,
            smeDesc: smeDesc, 
            smeRequirementsDesc: smeRequirementsDesc 
        });

    });

    return {
        annualStats: [], // Defer to context-aware logic, using empty array as placeholder if strictly needed by UI, or adapt UI
        results 
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
