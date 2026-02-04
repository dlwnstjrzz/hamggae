'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { analyzeEmployee } from '@/utils/taxCorrection/employeeDataParser';
import { calculateEmploymentIncreaseCredit } from '@/utils/taxCorrection/employmentIncrease';
import { calculateSocialInsuranceClaims } from '@/utils/taxCorrection/socialInsurance';
import { calculateIncomeIncreaseCredit } from '@/utils/taxCorrection/incomeIncrease';
import { aggregateTaxCreditSummary } from '@/utils/taxCorrection/summaryHelpers';

import { RiseOutlined, TeamOutlined, CalculatorOutlined } from '@ant-design/icons';
import { Select, Button } from 'antd';

// Custom Color Palette
const COLORS = {
  primary: '#615EFF',   // Purple/Blue - Main Actions, Active States
  success: '#00D3BB',   // Teal - Money, Positive
  danger: '#F43099',    // Pink - Exclusions, Delete, Highlights
  warning: '#FCB700',   // Yellow - Warnings
};

export default function EmploymentIncreaseCalculator({ initialData }) {
  const [processedData, setProcessedData] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  // Settings
  const [settings, setSettings] = useState({ region: 'non-capital', size: 'small' });

  // Results
  const [creditResults, setCreditResults] = useState(null);
  const [socialInsuranceResults, setSocialInsuranceResults] = useState(null);
  const [incomeIncreaseResults, setIncomeIncreaseResults] = useState(null);

  // Processing Status
  const [isCalculated, setIsCalculated] = useState(false);

  // 1. Initial Data Processing & Auto-Exclusion
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      // Separate Data Sources
      const withholdingFiles = initialData.filter(d => d.type === 'withholding');
      const registryFiles = initialData.filter(d => d.type === 'registry');
      const taxReturnFiles = initialData.filter(d => d.type === 'taxReturn');

      // Flatten Employees (Base List)
      let allEmployees = [];
      withholdingFiles.forEach(file => {
          if(file.employees) {
              const year = parseInt(file.year);
              const analyzed = file.employees.map(emp => {
                  const data = analyzeEmployee(emp, year);
                  // Default Exclusion State
                  return { ...data, exclusionReason: null, manualParams: {} };
              });
              allEmployees.push(...analyzed);
          }
      });

      // Auto-Detect Executives & Shareholders
      const normalizeName = (name) => {
          if (!name) return '';
          // Remove anything in parentheses (e.g., (자), (재입사)) and any digits
          return name.replace(/\(.*\)/g, '').replace(/[0-9]/g, '').trim();
      };

      allEmployees = allEmployees.map(emp => {
          let reason = null;
          const empNameClean = normalizeName(emp.name);
          const empIdPrefix = emp.id ? emp.id.split('-')[0] : '';

          // 1. Check Executives (Registry)
          for (const reg of registryFiles) {
              const executives = reg.executives || [];
              for (const exec of executives) {
                  const execNameClean = normalizeName(exec.name);
                  const execIdPrefix = exec.id ? exec.id.split('-')[0] : '';
                  
                  const isNameMatch = empNameClean === execNameClean;
                  const isIdMatch = (empIdPrefix && execIdPrefix) ? (empIdPrefix === execIdPrefix) : true;

                  if (isNameMatch && isIdMatch) {
                      const empYearStart = new Date(`${emp.year}-01-01`);
                      const empYearEnd = new Date(`${emp.year}-12-31`);
                      const execStart = exec.startDate ? new Date(exec.startDate) : new Date('1900-01-01');
                      const execEnd = exec.endDate ? new Date(exec.endDate) : new Date('2999-12-31');

                      if (execStart <= empYearEnd && execEnd >= empYearStart) {
                          reason = '임원';
                          break;
                      }
                  }
              }
              if (reason) break;
          }

          // 2. Check Shareholders (Tax Return)
          if (!reason) {
              for (const tax of taxReturnFiles) {
                  const taxYear = parseInt(tax.year);
                  if (!isNaN(taxYear) && taxYear !== emp.year) continue;

                  const shareholders = tax.data?.shareholders || [];
                  for (const holder of shareholders) {
                      const holderNameClean = normalizeName(holder.name);
                      const holderIdPrefix = holder.id ? holder.id.split('-')[0] : '';

                      const isNameMatch = empNameClean === holderNameClean;
                      const isIdMatch = (empIdPrefix && holderIdPrefix) ? (empIdPrefix === holderIdPrefix) : true;

                      if (isNameMatch && isIdMatch) {
                          reason = '최대주주및가족';
                          break;
                      }
                  }
                  if (reason) break;
              }
          }

          return { ...emp, exclusionReason: reason };
      });

      setProcessedData(allEmployees);
      
      const uniqueYears = [...new Set(allEmployees.map(d => d.year))].sort((a,b) => b - a);
      if (uniqueYears.length > 0) setActiveTab(uniqueYears[0].toString());
      
      // Perform initial calculation if data exists
      if(allEmployees.length > 0) {
          performCalculation(allEmployees, settings);
      }

    } else {
      setProcessedData([]);
    }
  }, [initialData]); 

  // Watch for settings changes to re-trigger calculation if needed or just mark dirty
  useEffect(() => {
     if(processedData.length > 0) {
         // Optionally auto-calculate on setting change, or just mark dirty
         // performCalculation(processedData, settings); // let's auto-calc for better UX
         setIsCalculated(false); 
     }
  }, [settings]);


  const performCalculation = (data, currentSettings) => {
      // Filter out excluded employees
      const validEmployees = data.filter(d => !d.exclusionReason);

      const creditRes = calculateEmploymentIncreaseCredit(validEmployees, currentSettings);
      setCreditResults(creditRes);

      const insuranceRes = calculateSocialInsuranceClaims(validEmployees);
      setSocialInsuranceResults(insuranceRes);

      const incomeRes = calculateIncomeIncreaseCredit(validEmployees, currentSettings);
      setIncomeIncreaseResults(incomeRes);

      const summary = aggregateTaxCreditSummary(creditRes, insuranceRes, incomeRes);
      setSummaryData(summary);
      
      setIsCalculated(true);
  };

  const handleRecalculate = () => {
      performCalculation(processedData, settings);
  };

  const updateExclusion = (empIndex, reason) => {
    // empIndex is actually the emp object itself in the map
    const newData = processedData.map(d => {
        if (d.name === empIndex.name && d.id === empIndex.id && d.year === empIndex.year) {
            return { ...d, exclusionReason: reason };
        }
        return d;
    });
    
    setProcessedData(newData);
    setIsCalculated(false); // Mark as dirty
  };

  const formatCurrency = (value) => {
      return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(value);
  };

  const getSummaryRows = () => {
      if (!summaryData) return [];
      const rows = [
          { key: 'emp', category: '고용증대 세액공제' },
          { key: 'int', category: '통합고용 세액공제' },
          { key: 'soc', category: '사회보험료 세액공제' },
          { key: 'inc', category: '근로소득증대 세액공제' },
      ];
      return rows.map(row => {
          const rowData = { ...row, total: 0 };
          summaryData.forEach(d => {
              let val = 0;
              if (row.key === 'emp') val = d.employmentIncrease;
              if (row.key === 'int') val = d.integratedEmployment;
              if (row.key === 'soc') val = d.socialInsurance;
              if (row.key === 'inc') val = d.incomeIncrease;
              rowData[d.year] = val;
              rowData.total += val;
          });
          return rowData;
      });
  };

  const calculateTotalRow = (rows) => {
      if (!summaryData || rows.length === 0) return {};
      const totalRow = { total: 0 };
      summaryData.forEach(d => {
          totalRow[d.year] = rows.reduce((acc, r) => acc + (r[d.year] || 0), 0);
          totalRow.total += totalRow[d.year];
      });
      return totalRow;
  }

  const summaryRows = getSummaryRows();
  const totalRow = calculateTotalRow(summaryRows);
  const summaryYears = summaryData ? summaryData.map(d => d.year).sort((a,b) => a-b) : [];

  if (processedData.length === 0) return null;

  return (
    <div className="space-y-10 animate-in fade-in pb-20">
        
        {/* Header & Settings */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
                 <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <RiseOutlined style={{ color: COLORS.primary }} /> 세액공제 계산 리포트
                 </h2>
                 <p className="text-slate-500 mt-1">
                    데이터가 변경되면 <strong style={{ color: COLORS.primary }}>[재계산]</strong> 버튼을 눌러주세요.
                 </p>
            </div>
 
            <div id="daisy-root">
                    <span className="text-sm font-bold text-slate-400">지역/기업 구분</span>
                    <form>
                        <input 
                            className="btn mr-1" 
                            type="checkbox" 
                            name="frameworks"
                            aria-label="수도권"
                            onChange={() => { setSettings({...settings, region: 'capital'}); setIsCalculated(false); }}
                        />
                        <input 
                            className="btn mr-1" 
                            type="checkbox" 
                            name="frameworks"
                            aria-label="수도권 외"
                            onChange={() => { setSettings({...settings, region: 'non-capital'}); setIsCalculated(false); }}
                        />
                        <input 
                            className="btn mr-1" 
                            type="checkbox" 
                            name="frameworks"
                            aria-label="중소기업"
                            onChange={() => { setSettings({...settings, size: 'small'}); setIsCalculated(false); }}
                        />
                        <input 
                            className="btn mr-1" 
                            type="checkbox" 
                            name="frameworks" 
                            aria-label="중견기업"
                            onChange={() => { setSettings({...settings, size: 'middle'}); setIsCalculated(false); }}
                        />
                         <input 
                            className="btn mr-1" 
                            type="checkbox" 
                            name="frameworks" 
                            aria-label="대기업"
                            onChange={() => { setSettings({...settings, size: 'large'}); setIsCalculated(false); }}
                        />
                        <input className="btn btn-square" type="reset" value="×"/>
                    </form>
            </div>
    
        </div>

        {/* Summary Table */}
        {summaryData && isCalculated && (
            <div className="card bg-white shadow-md border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4">
                <div className="card-body p-0">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-lg text-slate-800">📊 공제감면세액 최종 집계</h3>
                        <div className="badge border-none text-white" style={{ backgroundColor: COLORS.primary }}>최근 5년</div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="table table-zebra w-full text-center">
                            <thead className="bg-white text-slate-500 border-b border-gray-200">
                                <tr>
                                    <th className="text-left pl-6 py-4">구분</th>
                                    {summaryYears.map(year => <th key={year} className="py-4">{year}년</th>)}
                                    <th className="text-right pr-6 py-4 font-extrabold text-slate-800">5년 합계</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryRows.map((row) => (
                                    <tr key={row.key} className="hover">
                                        <td className="text-left font-medium pl-6 py-3">{row.category}</td>
                                        {summaryYears.map(year => (
                                            <td key={year} className="font-mono text-slate-600 py-3">
                                                {row[year] > 0 ? formatCurrency(row[year]) : <span className="opacity-20">-</span>}
                                            </td>
                                        ))}
                                        <td className="text-right font-bold pr-6 py-3" style={{ color: COLORS.primary }}>
                                            {formatCurrency(row.total)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                                    <td className="text-left pl-6 py-4">총 세액공제액</td>
                                    {summaryYears.map(year => (
                                        <td key={year} className="font-mono py-4" style={{ color: COLORS.success }}>
                                            {formatCurrency(totalRow[year])}
                                        </td>
                                    ))}
                                    <td className="text-right pr-6 text-lg py-4" style={{ color: COLORS.success }}>
                                        {formatCurrency(totalRow.total)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
        
        <div className="flex justify-center my-8">
             <button 
                className={`btn btn-lg rounded-2xl px-8 shadow-sm transition-all duration-300 ${showDetails ? 'btn-outline border-slate-300' : 'text-white'}`}
                style={!showDetails ? { backgroundColor: 'black', border: 'none' } : {}}
                onClick={() => setShowDetails(!showDetails)}
            >
                 {showDetails ? '세부 내역 접기' : '세부 내역 및 데이터 수정'}
            </button>
        </div>

        {/* Details Section */}
        {showDetails && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                 
                {/* 1. Employee Data Tabs */}
                <div className="card bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.primary}15`, color: COLORS.primary }}>
                                <TeamOutlined className="text-xl" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-slate-800">연도별 근로자 데이터 관리</h3>
                                <p className="text-xs text-slate-500 mt-1">임원 및 주주를 제외하려면 제외사유를 선택하세요.</p>
                            </div>
                        </div>
                        {/* Tab List */}
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            {[...new Set(processedData.map(d => d.year))].sort((a,b) => b-a).map(year => (
                                <button 
                                    key={year} 
                                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === year.toString() ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    style={activeTab === year.toString() ? { color: COLORS.primary, fontWeight: 'bold' } : {}}
                                    onClick={() => setActiveTab(year.toString())}
                                >
                                    {year}년
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="p-0">
                        <div className="overflow-x-auto max-h-[600px]">
                            <table className="table table-pin-rows table-sm w-full">
                                <thead className="bg-slate-50 text-slate-600 font-semibold z-10">
                                    <tr>
                                        <th className="bg-slate-50 w-12 text-center">No</th>
                                        <th className="bg-slate-50">이름 / 주민번호</th>
                                        <th className="bg-slate-50">입사일 / 퇴사일</th>
                                        <th className="bg-slate-50 text-right">총급여</th>
                                        {/* Split Columns */}
                                        <th className="bg-slate-50 text-center" style={{ color: COLORS.primary }}>청년 근속</th>
                                        <th className="bg-slate-50 text-center">일반 근속</th>
                                        <th className="bg-slate-50 text-center w-40">제외사유 (설정)</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    {processedData
                                        .filter(d => d.year.toString() === activeTab)
                                        .sort((a,b) => {
                                            // Sort: Excluded last, then by Salary desc
                                            if (a.exclusionReason && !b.exclusionReason) return 1;
                                            if (!a.exclusionReason && b.exclusionReason) return -1;
                                            return b.totalSalary - a.totalSalary;
                                        })
                                        .map((emp, idx) => (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${emp.exclusionReason ? 'bg-slate-50/80' : ''}`}>
                                            <td className="text-center text-slate-400 text-xs">{idx + 1}</td>
                                            <td>
                                                <div className={`font-medium ${emp.exclusionReason ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900'}`}>
                                                    {emp.name}
                                                </div>
                                                <div className="font-mono text-[10px] text-slate-400">{emp.id}</div>
                                            </td>
                                            <td className="text-xs text-slate-600">
                                                <div>{emp.hireDate}</div>
                                                <div className="text-slate-400">{emp.retireDate || '-'}</div>
                                            </td>
                                            <td className={`text-right font-mono ${emp.exclusionReason ? 'text-slate-400' : 'text-slate-700'}`}>
                                                {formatCurrency(emp.totalSalary)}
                                            </td>
                                            
                                            {/* Youth Months */}
                                            <td className="text-center text-xs">
                                                {emp.youthMonths > 0 ? (
                                                    <span className="font-bold" style={{ color: emp.exclusionReason ? '#ccc' : COLORS.primary }}>
                                                        {emp.youthMonths}개월
                                                    </span>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>
                                            
                                            {/* Normal Months */}
                                            <td className="text-center text-xs">
                                                {emp.normalMonths > 0 ? (
                                                    <span className="font-medium text-slate-500">
                                                        {emp.normalMonths}개월
                                                    </span>
                                                ) : <span className="text-slate-300">-</span>}
                                            </td>

                                            <td className="text-center">
                                                <Select
                                                    value={emp.exclusionReason}
                                                    placeholder="포함"
                                                    onChange={(val) => updateExclusion(emp, val)}
                                                    bordered={false}
                                                    className={`w-32 text-xs ${emp.exclusionReason ? 'opacity-100' : 'opacity-60 hover:opacity-100'}`}
                                                    dropdownMatchSelectWidth={false}
                                                    options={[
                                                        { value: null, label: <span style={{ color: COLORS.success,fontWeight: 'bold' }}>포함</span> },
                                                        { value: '임원', label: <span style={{ color: COLORS.danger, fontWeight: 'bold' }}>임원</span> },
                                                        { value: '최대주주및가족', label: <span style={{ color: COLORS.danger, fontWeight: 'bold' }}>최대주주 및 친족</span> },
                                                        { value: '기타', label: <span className="text-gray-500">계약직</span> },
                                                    ]}
                                                />
            
                                            </td>
                                        </tr>
                                    ))}
                                    {processedData.filter(d => d.year.toString() === activeTab).length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center py-12 text-slate-400">
                                                데이터가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Recalculate Button (Moved) */}
                <div className="flex justify-end">
                    <button 
                        onClick={handleRecalculate}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 shadow-sm gap-2"
                    >
                        <CalculatorOutlined />
                        {isCalculated ? '재계산 완료' : '변경사항 적용 및 재계산'}
                    </button>
                </div>

                {/* Excluded Executives & Shareholders List - Clean Matrix View */}
                {processedData.some(d => d.exclusionReason) && (() => {
                    // 1. Pivot Data Preparation
                    const excludedIds = new Set(processedData.filter(d => d.exclusionReason).map(d => d.id));
                    const grouped = {};
                    const allYears = [...new Set(processedData.map(d => d.year))].sort((a,b) => a-b);

                    processedData.forEach(d => {
                        if (excludedIds.has(d.id)) { 
                            if (!grouped[d.id]) {
                                grouped[d.id] = {
                                    name: d.name,
                                    id: d.id,
                                    hireDate: d.hireDate, // Assuming static for display, or take latest
                                    retireDate: d.retireDate,
                                    years: {} // map year -> data
                                };
                            }
                            grouped[d.id].years[d.year] = d;
                            // Update dates if needed (e.g. re-hire), but usually static for same ID
                            if (d.hireDate) grouped[d.id].hireDate = d.hireDate;
                            if (d.retireDate) grouped[d.id].retireDate = d.retireDate;
                        }
                    });

                    return (
                        <div className="card bg-white shadow-sm border border-slate-200">
                            <div className="card-body p-6">
                                <h3 className="card-title text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="text-xl">🚫</span> 제외 대상자 명단 (임원 및 최대주주 등)
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    주민등록번호 및 근로기간 등 <strong>고유 정보</strong>는 좌측에, 
                                    연도별 <strong>제외 사유와 급여</strong>는 우측에 표시하여 변화를 한눈에 볼 수 있습니다.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="table table-sm w-full text-center border-separate border-spacing-0">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="bg-slate-50 sticky left-0 z-10 border-r border-slate-200 min-w-[80px]">이름</th>
                                                <th className="bg-slate-50 border-r border-slate-200 min-w-[200px]">인적 사항</th>
                                                {allYears.map(y => (
                                                    <th key={y} className="min-w-[120px] border-b border-r border-slate-100 p-3">{y}년</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.values(grouped).map((person, idx) => {
                                                return (
                                                    <tr key={idx} className="hover">
                                                        {/* 1. Name (Sticky) */}
                                                        <td className="font-bold text-slate-700 bg-white sticky left-0 z-0 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                            {person.name}
                                                        </td>
                                                        
                                                        {/* 2. Static Info (ID, Dates) */}
                                                        <td className="text-xs text-left bg-slate-50/30 border-r border-slate-200 p-3">
                                                            <div className="font-mono text-slate-500 mb-1">{person.id}</div>
                                                            <div className="text-slate-400">
                                                                {person.hireDate} ~ {person.retireDate || ''}
                                                            </div>
                                                        </td>

                                                        {/* 3. Dynamic Year Columns */}
                                                        {allYears.map(y => {
                                                            const yearData = person.years[y];
                                                            if (!yearData) return <td key={y} className="bg-slate-50/50 border-r border-slate-100">-</td>;
                                                            
                                                            const isExcluded = !!yearData.exclusionReason;
                                                            return (
                                                                <td key={y} className={`border-r border-slate-100 text-xs p-2 align-middle ${isExcluded ? 'bg-pink-50' : ''}`}>
                                                                    <div className="flex flex-col items-center gap-1">
                                                                        {isExcluded && (
                                                                            <span className="badge badge-sm border-0 font-bold text-white bg-pink-500 w-full mb-1">
                                                                                {yearData.exclusionReason}
                                                                            </span>
                                                                        )}
                                                                        <span className={`font-mono font-bold ${isExcluded ? 'text-pink-700' : 'text-slate-400'}`}>
                                                                            {formatCurrency(yearData.totalSalary)}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* 2. Employment Increase Credit Details */}
                {creditResults && (() => {
                    const recentYears = [...creditResults.annualAverages]
                        .sort((a, b) => b.year - a.year)
                        .slice(0, 5)
                        .sort((a, b) => a.year - b.year);
                    
                    return (
                        <div className="card bg-white shadow-sm border border-slate-200">
                            <div className="card-body p-6">
                                <h3 className="card-title text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="text-xl">💰</span> 고용증대 세액공제 상세
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra text-center w-full">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="text-left w-48">구분</th>
                                                {recentYears.map(record => (
                                                    <th key={record.year} className="min-w-[80px]">{record.year}년</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="text-left font-medium text-slate-600">청년 등 상시근로자</td>
                                                {recentYears.map(record => (
                                                    <td key={record.year}>{record.youthCount.toFixed(2)}</td>
                                                ))}
                                            </tr>
                                            <tr>
                                                <td className="text-left font-medium text-slate-600">청년 외 상시근로자</td>
                                                {recentYears.map(record => (
                                                    <td key={record.year}>{record.normalCount.toFixed(2)}</td>
                                                ))}
                                            </tr>
                                            <tr>
                                                <td className="text-left font-medium text-slate-600">전체 상시근로자</td>
                                                {recentYears.map(record => (
                                                    <td key={record.year} className="font-bold text-slate-800">
                                                        {record.overallCount.toFixed(2)}
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr>
                                                <td className="text-left font-medium text-slate-600">공제세액</td>
                                                {recentYears.map(record => {
                                                    const res = creditResults.results.find(r => r.year === record.year);
                                                    return (
                                                        <td key={record.year} className="font-bold" style={{ color: COLORS.success }}>
                                                            {res ? formatCurrency(res.totalCredit) : '-'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* 3. Social Insurance Credit Details */}
                {socialInsuranceResults && (() => {
                    const recentYears = [...socialInsuranceResults.results]
                        .sort((a, b) => b.year - a.year)
                        .slice(0, 5)
                        .sort((a, b) => a.year - b.year);
                    
                    return (
                        <div className="card bg-white shadow-sm border border-slate-200">
                            <div className="card-body p-6">
                                <h3 className="card-title text-slate-800 mb-4 flex items-center gap-2">
                                     <span className="text-xl">🛡️</span> 사회보험료 세액공제 상세
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="table table-zebra text-center w-full">
                                        <thead className="bg-slate-50 text-slate-600">
                                            <tr>
                                                <th className="text-left w-48">구분</th>
                                                {recentYears.map(item => (
                                                    <th key={item.year} className="min-w-[80px]">{item.year}년</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="text-left font-medium text-slate-600">청년 순증</td>
                                                {recentYears.map(item => (
                                                    <td key={item.year}>{item.youthIncrease.toFixed(2)}</td>
                                                ))}
                                            </tr>
                                            <tr>
                                                <td className="text-left font-medium text-slate-600">청년 외 순증</td>
                                                {recentYears.map(item => (
                                                    <td key={item.year}>{item.normalIncrease.toFixed(2)}</td>
                                                ))}
                                            </tr>
                                            <tr>
                                                <td className="text-left font-medium text-slate-600">예상 공제세액</td>
                                                {recentYears.map(item => (
                                                    <td key={item.year} className="font-bold" style={{ color: COLORS.success }}>
                                                        {formatCurrency(item.estimatedCredit)}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    );
                })()}

                {/* 4. Income Increase Credit Details */}
                {incomeIncreaseResults && (
                    <div className="card bg-white shadow-sm border border-slate-200 mb-8">
                         <div className="card-body p-6">
                            <h3 className="card-title text-slate-800 mb-4 flex items-center gap-2">
                                <span className="text-xl">📈</span> 근로소득증대 세액공제 상세
                            </h3>
                            {incomeIncreaseResults.results.map((record) => (
                                <div key={record.year} className="collapse collapse-plus border border-slate-200 bg-white rounded-lg mb-2">
                                    <input type="checkbox" /> 
                                    <div className="collapse-title text-sm font-medium flex justify-between items-center pr-12">
                                        <div className="flex gap-4 items-center">
                                            <span className="font-bold bg-slate-100 px-2 py-1 rounded">{record.year}년</span>
                                            <span className="text-slate-500">임금증가율: {(record.rateT * 100).toFixed(2)}%</span>
                                        </div>
                                        <div className="font-bold" style={{ color: COLORS.success }}>
                                            {formatCurrency(record.taxCredit)}
                                        </div>
                                    </div>
                                    <div className="collapse-content text-xs bg-slate-50">
                                        <div className="py-4 space-y-4">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div>
                                                    <span className="block text-slate-400 mb-1">직전 5년 무사고 (당해)</span>
                                                    <span className="font-mono text-slate-700">{record.employeeCountCurr.toFixed(2)}명</span>
                                                </div>
                                                <div>
                                                    <span className="block text-slate-400 mb-1">평균임금 (당해)</span>
                                                    <span className="font-mono text-slate-700">{formatCurrency(record.avgWageT)}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-slate-400 mb-1">3년 평균 증가율</span>
                                                    <span className="font-mono text-slate-700">{(record.avgPrevRate * 100).toFixed(2)}%</span>
                                                </div>
                                                <div>
                                                    <span className="block text-slate-400 mb-1">계산식</span>
                                                    <span className="font-mono text-[10px] text-slate-500 break-all">{record.calcDetails}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                )}

            </div>
        )}
    </div>
  );
}
