'use client';

import React, { useState, useEffect } from 'react';
import { analyzeEmployee } from '../utils/taxCorrection/employeeDataParser';
import { calculateEmploymentIncreaseCredit } from '../utils/taxCorrection/employmentIncrease';
import { calculateSocialInsuranceClaims } from '../utils/taxCorrection/socialInsurance';
import { calculateIncomeIncreaseCredit } from '../utils/taxCorrection/incomeIncrease';
import { aggregateTaxCreditSummary } from '../utils/taxCorrection/summaryHelpers';
import { generateTaxCreditExcel } from '../utils/excelGenerator';

import { RiseOutlined, TeamOutlined, CalculatorOutlined, FileTextOutlined, SafetyCertificateOutlined, DollarOutlined, ExclamationCircleOutlined, DownloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

// Sub-component for individual Cohort Card to manage local state (Year Tabs)
const IncomeCohortCard = ({ record, formatNumber }) => {
    const targetYear = record.year;
    // History years: T-4 to T
    const historyYears = [4, 3, 2, 1, 0].map(delta => targetYear - delta);
    const [selectedDetailYear, setSelectedDetailYear] = useState(targetYear);
    
    // Ensure selected year is valid (in case)
    const activeStat = record.history[selectedDetailYear];

    return (
        <div className="card shadow-md bg-base-100 border border-base-200 overflow-hidden">
            {/* Card Header */}
            {/* refined header: details full width */}
            <div className="bg-base-200/50 p-4 border-b border-base-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-3">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="badge badge-lg border-none text-white font-bold bg-slate-700">{record.year}년 귀속분</div>
                            <div className={`badge badge-outline font-bold ${
                                record.calculationMethod === 'sme' ? 'badge-primary' : 
                                record.calculationMethod === 'special' ? 'badge-secondary' : 'badge-neutral'
                            }`}>
                                {record.calculationMethod === 'sme' ? '중소기업 특례' : (record.calculationMethod === 'special' ? '계산특례' : '일반계산')}
                            </div>
                        </div>
                        <div className="text-sm">
                            산출 공제액: <strong className="text-base-content text-sm">{formatNumber(record.taxCredit)}원</strong>
                        </div>
                    </div>
                </div>
                
                {/* Detailed Calculation Breakdown */}
                <div className="w-full bg-base-100 rounded border border-base-300 p-3 flex flex-col gap-3">
                    {record.allCalculations && record.allCalculations.length > 0 ? (
                        record.allCalculations.map((calc, idx) => (
                             <div key={idx} className={`flex flex-col gap-1 ${calc.method === record.calculationMethod ? 'opacity-100' : 'opacity-70'}`}>
                                 <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2">
                                     <span className={`badge badge-sm font-bold whitespace-nowrap gap-1 ${calc.method === record.calculationMethod ? 'badge-primary' : 'badge-ghost'}`}>
                                         {calc.label}
                                         <span className="opacity-80 border-l border-base-content/20 pl-1 ml-1">{formatNumber(calc.credit)}원</span>
                                     </span>
                                     <span className="text-xs md:text-sm font-mono text-base-content/50 break-all leading-tight">
                                         {calc.formula}
                                     </span>
                                 </div>
                                 <div className="pl-2 border-l-2 border-base-300 ml-1">
                                     <span className="font-mono text-sm font-bold break-all leading-tight block text-base-content/80">
                                         {calc.desc}
                                     </span>
                                 </div>
                             </div>
                        ))
                    ) : (
                         <div className="flex items-start gap-2">
                             <span className="text-sm font-mono break-all leading-tight text-base-content/70">
                                {record.calcDetails}
                             </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="card-body p-6">
                <h4 className="text-sm font-bold opacity-70 mb-4 flex items-center gap-2">
                    <CalculatorOutlined /> 최근 5년 임금 및 고용 추이 ({targetYear - 4} ~ {targetYear})
                </h4>
                
                {/* 5-Year History Table */}
                <div className="overflow-x-auto border border-base-200 rounded-lg mb-8">
                    <table className="table table-sm w-full text-center">
                        <thead className="bg-base-100/50 text-sm">
                            <tr>
                                <th className="min-w-[80px]">연도</th>
                                <th>상시근로자 수</th>
                                <th>평균 임금 (전체)</th>
                                <th>평균 임금 (신규제외)</th>
                                <th>전년 대비 증가율</th>
                                <th className="w-1/4">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyYears.map((y, idx) => {
                                const stat = record.history[y];
                                const isTarget = y === targetYear;
                                const isPrev = y === targetYear - 1;

                                if (!stat) {
                                        return (
                                        <tr key={y} className="opacity-30">
                                            <td className="font-bold">{y}년</td>
                                            <td colSpan={5} className="text-sm text-left pl-4">데이터 없음</td>
                                        </tr>
                                        );
                                }

                                // Determine row highlight
                                let rowClass = `border-base-100 relative`;
                                if (y === selectedDetailYear) rowClass += ' ring-2 ring-primary font-bold z-10 bg-base-100';
                                else if (isTarget) rowClass += ' font-bold bg-primary/5';
                                else rowClass += ' bg-base-100'; // Unified background

                                return (
                                    <tr key={y} className={rowClass}>
                                        <td className="font-bold border-r border-base-200">
                                            {y}년
                                        </td>
                                        <td className="font-mono">
                                            {stat.fte}명
                                            <div className="text-xs text-base-content/40 opacity-70 mt-1">
                                                {stat.fteNumerator || 0} / {stat.fteDenominator || 12}
                                            </div>
                                        </td>
                                        <td className="font-mono text-sm">
                                            {formatNumber(stat.avgWage)}
                                            <div className="text-xs text-base-content/40 opacity-70 mt-1">
                                                {formatNumber(stat.avgWageNumerator || 0)} / {(stat.avgWageDenominator || 0).toFixed(2)}
                                            </div>
                                        </td>
                                        <td className="font-mono text-sm">
                                            <div className="tooltip" data-tip="신규 입사자를 제외한 재직자 평균임금">
                                                {formatNumber(stat.avgWageExcl)}
                                                <div className="text-xs text-base-content/40 opacity-70 mt-1 font-normal">
                                                    {formatNumber(stat.avgWageExclNumerator || 0)} / {(stat.avgWageExclDenominator || 0).toFixed(2)}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="font-mono text-sm font-bold">
                                            {stat.growthRate !== null && stat.growthRate !== undefined ? (
                                                <span className={stat.growthRate > 0 ? 'text-success' : (stat.growthRate < 0 ? 'text-error' : '')}>
                                                    {stat.growthRate > 0 ? '+' : ''}{(stat.growthRate * 100).toFixed(2)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="text-left text-sm text-base-content/60 px-4">
                                            {isTarget && (
                                                <div className="flex flex-col gap-1 items-start">
                                                    {(() => {
                                                        // Determine which conditions to show based on the calculation method
                                                        let conditions = null;
                                                        
                                                        // 1. If Special Provision used, show its conditions
                                                        if (record.calculationMethod === 'special' && record.specialConditions && record.specialConditions.length > 0) {
                                                            conditions = { title: '계산특례', items: record.specialConditions };
                                                        } 
                                                        // 2. If SME used, show SME conditions
                                                        else if (record.calculationMethod === 'sme' && record.smeConditions && record.smeConditions.length > 0) {
                                                            conditions = { title: '중소요건', items: record.smeConditions };
                                                        }
                                                        // 3. Fallback / General / Failure
                                                        else {
                                                            // If Tax Credit is 0 and we are Small (SME conditions exist), show why SME failed
                                                            if (record.taxCredit === 0 && record.smeConditions && record.smeConditions.length > 0) {
                                                                conditions = { title: '중소요건', items: record.smeConditions };
                                                            } else {
                                                                // Default to General
                                                                conditions = { title: '일반요건', items: record.generalConditions };
                                                            }
                                                        }

                                                        if (conditions && conditions.items && conditions.items.length > 0) {
                                                            return (
                                                                <>
                                                                    <div className="text-xs leading-tight font-mono break-keep">
                                                                        <span className="font-bold mr-1">[{conditions.title}]</span>
                                                                        {conditions.items.map((c, idx) => (
                                                                            <span key={idx} className={`${c.isMet ? 'text-success' : 'text-error'} mr-1`}>
                                                                                {c.label}({c.val}) {c.op} {c.target}
                                                                                {idx < conditions.items.length - 1 && ','}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    {record.comparisonNote && (
                                                                        <span className="text-xs text-base-content/60 mt-0.5">
                                                                            {record.comparisonNote}
                                                                        </span>
                                                                    )}
                                                                </>
                                                            );
                                                        }
                                                        
                                                        // Fallback (Legacy or missing data)
                                                        return (
                                                            <>
                                                               {record.comparisonNote && <span className="text-xs">{record.comparisonNote}</span>}
                                                               {record.failureNote && <span className="text-xs text-error">{record.failureNote}</span>}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot className="text-xs text-base-content/40 bg-base-100">
                                <tr>
                                    <td colSpan={6} className="text-right py-2 pr-4">
                                        <div className="flex flex-col gap-1 items-end">
                                             {record.calculationMethod === 'general' && (
                                                <span>* 일반계산: 당해연도 증가분 - (직전연도 × 3년평균 증가율)</span>
                                             )}
                                             <span>* 단위: 원</span>
                                        </div>
                                    </td>
                                </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Detail Year Tabs & Tables */}
                <div className="border border-base-200 rounded-lg p-4 bg-base-50">
                     <div className="tabs tabs-box mb-4" role="tablist">
                         {historyYears.map(y => (
                             <input 
                                 key={y} 
                                 type="radio"
                                 name="my_tabs_1"
                                 className={`tab ${selectedDetailYear === y ? 'tab-active' : ''}`}
                                 onClick={() => setSelectedDetailYear(y)}
                                 aria-label={`${y}년 상세`}
                             />
                         ))}
                     </div>
                     
                     {activeStat ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                            {/* Included Employees */}
                            <div className="flex flex-col h-[400px] border border-base-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="bg-primary/5 p-3 border-b border-base-200 flex justify-between items-center">
                                        <div className="font-bold text-sm text-primary flex items-center gap-2">
                                            <TeamOutlined /> {selectedDetailYear}년 포함 대상 ({activeStat.includedEmployees ? activeStat.includedEmployees.length : 0}명)
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        <table className="table table-xs table-pin-rows w-full">
                                            <thead className="bg-base-100/80 backdrop-blur z-10">
                                                <tr>
                                                    <th>이름</th>
                                                    <th>입사일 / 퇴사일</th>
                                                    <th className="text-right">총급여</th>
                                                    <th className="text-right">근속월수(청년/일반)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeStat.includedEmployees && activeStat.includedEmployees.length > 0 ? (
                                                    activeStat.includedEmployees.sort((a,b) => b.totalSalary - a.totalSalary).map((emp, i) => (
                                                        <tr key={i} className="hover">
                                                            <td className="font-bold text-sm">{emp.name}</td>
                                                            <td className="text-xs opacity-70">
                                                                <div>{emp.hireDate}</div>
                                                                {emp.retireDate && <div className="text-error">{emp.retireDate}</div>}
                                                            </td>
                                                            <td className="text-right font-mono text-sm">
                                                                {formatNumber(emp.totalSalary)}
                                                            </td>
                                                            <td className="text-right font-mono text-sm">
                                                                {emp.youthMonths}/{emp.normalMonths}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="text-center py-10 opacity-30">데이터 없음</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                            </div>

                            {/* Excluded Employees */}
                            <div className="flex flex-col h-[400px] border border-base-200 rounded-lg overflow-hidden bg-white shadow-sm">
                                    <div className="bg-error/5 p-3 border-b border-base-200 flex justify-between items-center">
                                        <div className="font-bold text-sm text-error flex items-center gap-2">
                                            <ExclamationCircleOutlined /> {selectedDetailYear}년 제외 대상 ({activeStat.excludedEmployees ? activeStat.excludedEmployees.length : 0}명)
                                        </div>
                                    </div>
                                    <div className="overflow-y-auto flex-1">
                                        <table className="table table-xs table-pin-rows w-full">
                                            <thead className="bg-base-100/80 backdrop-blur z-10">
                                                <tr>
                                                    <th>이름</th>
                                                    <th>입사일 / 퇴사일</th>
                                                    <th className="text-right">총급여</th>
                                                    <th className="text-right">근속(청년/일반)</th>
                                                    <th>제외 사유</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeStat.excludedEmployees && activeStat.excludedEmployees.length > 0 ? (
                                                    activeStat.excludedEmployees.map((ex, i) => (
                                                        <tr key={i} className="hover">
                                                            <td className="font-medium whitespace-nowrap">{ex.name}</td>
                                                            <td className="text-xs opacity-70">
                                                                <div>{ex.hireDate}</div>
                                                                {ex.retireDate && <div className="text-error">{ex.retireDate}</div>}
                                                            </td>
                                                            <td className="text-right font-mono text-sm">
                                                                {formatNumber(ex.totalSalary)}
                                                            </td>
                                                            <td className="text-right font-mono text-sm">
                                                                {ex.youthMonths}/{ex.normalMonths}
                                                            </td>
                                                            <td className="text-error text-xs break-keep leading-tight font-bold">
                                                                {ex.reason === '연말 기준 미재직' ? '5년 내 퇴사이력' : ex.reason}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={5} className="text-center py-10 opacity-30">제외 대상자가 없습니다.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                            </div>
                        </div>
                     ) : (
                         <div className="text-center py-10 opacity-40">해당 연도의 데이터가 없습니다.</div>
                     )}
                </div>
            </div>
        </div>
    );
};



const EmployeeListTable = ({ yearData, onUpdateExclusion, formatNumber }) => {
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' });

    const handleSort = (key) => {
        setSortConfig(current => {
            if (current.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'desc' };
        });
    };

    const sortedData = React.useMemo(() => {
        let items = [...yearData];
        if (sortConfig.key) {
            items.sort((a, b) => {
                let valA = a[sortConfig.key] || 0;
                let valB = b[sortConfig.key] || 0;
                
                if (sortConfig.key === 'name') {
                    return sortConfig.direction === 'asc' 
                        ? valA.localeCompare(valB, 'ko') 
                        : valB.localeCompare(valA, 'ko');
                }
                
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
             // Default Sort (Existing Logic)
             items.sort((a,b) => {
                if (a.exclusionReason && !b.exclusionReason) return 1;
                if (!a.exclusionReason && b.exclusionReason) return -1;
                return b.totalSalary - a.totalSalary;
            });
        }
        return items;
    }, [yearData, sortConfig]);

    return (
      <div className="overflow-x-auto">
        <table className="table">
            <thead>
                <tr>
                    <th className="w-12 text-center">No</th>
                    <th>
                        <div 
                            className="flex items-center gap-1 cursor-pointer hover:bg-base-200 py-1 rounded transition-colors select-none w-fit px-2"
                            onClick={() => handleSort('name')}
                        >
                            이름 / 주민번호
                            {sortConfig.key === 'name' ? (
                                sortConfig.direction === 'asc' ? <ArrowUpOutlined className="text-xs" /> : <ArrowDownOutlined className="text-xs" />
                            ) : (
                                <div className="flex flex-col text-[8px] leading-[0.5] opacity-30">
                                    <ArrowUpOutlined />
                                    <ArrowDownOutlined />
                                </div>
                            )}
                        </div>
                    </th>
                    <th>입사일 / 퇴사일</th>
                    <th className="text-right">총급여</th>
                    <th className="text-center">청년 근속</th>
                    <th className="text-center">
                        <div 
                            className="flex items-center justify-center gap-1 cursor-pointer hover:bg-base-200 py-1 rounded transition-colors select-none"
                            onClick={() => handleSort('normalMonths')}
                        >
                            일반 근속
                            {sortConfig.key === 'normalMonths' ? (
                                sortConfig.direction === 'asc' ? <ArrowUpOutlined className="text-xs" /> : <ArrowDownOutlined className="text-xs" />
                            ) : (
                                <div className="flex flex-col text-[8px] leading-[0.5] opacity-30">
                                    <ArrowUpOutlined />
                                    <ArrowDownOutlined />
                                </div>
                            )}
                        </div>
                    </th>
                    <th className="text-center w-40">제외사유</th>
                </tr>
            </thead>
            <tbody>
                {sortedData.map((emp, idx) => (
                    <tr key={idx} className="hover">
                        <th>{idx + 1}</th>
                        <td>
                            <div className={`font-medium ${emp.exclusionReason ? 'opacity-40 line-through' : ''}`}>
                                {emp.name}
                            </div>
                            <div className="font-mono text-xs opacity-40">{emp.id}</div>
                        </td>
                        <td className="text-sm opacity-70">
                            <div>{emp.hireDate}</div>
                            <div className="opacity-60">{emp.retireDate || '-'}</div>
                        </td>
                        <td className={`text-right font-mono ${emp.exclusionReason ? 'opacity-40' : ''}`}>
                            {formatNumber(emp.totalSalary)}
                        </td>
                        <td className="text-center text-sm">
                            {emp.youthMonths > 0 ? (
                                <span className={`font-bold ${emp.exclusionReason ? 'opacity-30' : ''}`}>
                                    {emp.youthMonths}개월
                                </span>
                            ) : <span className="opacity-20">-</span>}
                        </td>
                        <td className="text-center text-sm">
                            {emp.normalMonths > 0 ? (
                                <span className="font-medium opacity-60">
                                    {emp.normalMonths}개월
                                </span>
                            ) : <span className="opacity-20">-</span>}
                        </td>
                        <td className="text-center">
                             <select 
                                className={`select select-ghost font-normal ${emp.exclusionReason ? 'text-error font-bold' : 'text-success font-bold'}`}
                                value={emp.exclusionReason || ''}
                                onChange={(e) => onUpdateExclusion(emp, e.target.value || null)}
                            >
                                <option value="" className="text-success font-bold">포함</option>
                                <option value="임원" className="text-error font-bold">임원</option>
                                <option value="최대주주및가족" className="text-error font-bold">최대주주 및 친족</option>
                                <option value="기타" className="text-base-content">계약직/기타</option>
                            </select>
                        </td>
                    </tr>
                ))}
            </tbody>
            <tfoot>
                 <tr className="bg-base-200/50 font-bold border-t border-base-300">
                     <td colSpan={2} className="text-center font-bold">합 계</td>
                     <td colSpan={2}></td>
                     <td className="text-center font-mono">
                         {(sortedData.reduce((acc, emp) => acc + (emp.youthMonths || 0), 0)).toFixed(2)}
                     </td>
                     <td className="text-center font-mono">
                         {(sortedData.reduce((acc, emp) => acc + (emp.normalMonths || 0), 0)).toFixed(2)}
                     </td>
                     <td></td>
                 </tr>
            </tfoot>
        </table>
      </div>
  );
};

export default function EmploymentIncreaseCalculator({ initialData }) {
  const [processedData, setProcessedData] = useState([]);
  const [activeMainTab, setActiveMainTab] = useState('summary'); // 'summary', 'employment', 'integrated', 'social', 'income'
  const [activeYearTab, setActiveYearTab] = useState(null); // Managed via radio inputs for tabs-lifted

  const [summaryData, setSummaryData] = useState(null);
  
  // Settings
  const [settings, setSettings] = useState({ region: 'capital', size: 'small' });

  // Results
  const [creditResults, setCreditResults] = useState(null); // Contains both employmentIncreaseResults and integratedEmploymentResults
  const [socialInsuranceResults, setSocialInsuranceResults] = useState(null);
  const [incomeIncreaseResults, setIncomeIncreaseResults] = useState(null);

  // Processing Status
  const [isCalculated, setIsCalculated] = useState(false);
  const [showClawback, setShowClawback] = useState(false);

  // 1. Initial Data Processing
  useEffect(() => {
    if (initialData && initialData.length > 0) {
      // Data Parsing Logic (Same as before)
      const withholdingFiles = initialData.filter(d => d.type === 'withholding');
      const registryFiles = initialData.filter(d => d.type === 'registry');
      const taxReturnFiles = initialData.filter(d => d.type === 'taxReturn');

      let allEmployees = [];
      withholdingFiles.forEach(file => {
          if(file.employees) {
              const year = parseInt(file.year);
              const analyzed = file.employees.map(emp => {
                  const data = analyzeEmployee(emp, year);
                  return { ...data, exclusionReason: null, manualParams: {} };
              });
              allEmployees.push(...analyzed);
          }
      });

      const normalizeName = (name) => {
          if (!name) return '';
          return name.replace(/\(.*\)/g, '').replace(/[0-9]/g, '').trim();
      };

      allEmployees = allEmployees.map(emp => {
          let reason = null;
          const empNameClean = normalizeName(emp.name);
          const empIdPrefix = emp.id ? emp.id.split('-')[0] : '';

          for (const reg of registryFiles) {
              const executives = reg.executives || [];
              for (const exec of executives) {
                  const execNameClean = normalizeName(exec.name);
                  const execIdPrefix = exec.id ? exec.id.split('-')[0] : '';
                  if (empNameClean === execNameClean && ((empIdPrefix && execIdPrefix) ? (empIdPrefix === execIdPrefix) : true)) {
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

          if (!reason) {
              for (const tax of taxReturnFiles) {
                  const taxYear = parseInt(tax.year);
                  if (!isNaN(taxYear) && taxYear !== emp.year) continue;
                  const shareholders = tax.data?.shareholders || [];
                  for (const holder of shareholders) {
                      const holderNameClean = normalizeName(holder.name);
                      const holderIdPrefix = holder.id ? holder.id.split('-')[0] : '';
                      if (empNameClean === holderNameClean && ((empIdPrefix && holderIdPrefix) ? (empIdPrefix === holderIdPrefix) : true)) {
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
      if (uniqueYears.length > 0) setActiveYearTab(uniqueYears[0].toString()); // Still track active year for non-lifted contexts if needed, but mainly for default
      
      if(allEmployees.length > 0) {
          performCalculation(allEmployees, settings);
      }

    } else {
      setProcessedData([]);
    }
  }, [initialData]); 

  useEffect(() => {
     if(processedData.length > 0) {
         setIsCalculated(false); 
     }
  }, [settings]);

  const performCalculation = (data, currentSettings) => {
      const validEmployees = data.filter(d => !d.exclusionReason);

      const creditRes = calculateEmploymentIncreaseCredit(validEmployees, currentSettings);
      setCreditResults(creditRes);

      const insuranceRes = calculateSocialInsuranceClaims(validEmployees, { isNewGrowth: false });
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
    const newData = processedData.map(d => {
        if (d.name === empIndex.name && d.id === empIndex.id && d.year === empIndex.year) {
            return { ...d, exclusionReason: reason };
        }
        return d;
    });
    setProcessedData(newData);
    setIsCalculated(false);
  };

  const formatNumber = (value) => {
      return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
  };

  const getClawbackData = () => {
      if (!creditResults || !creditResults.annualAverages || !creditResults.employmentIncreaseResults) return [];
      
      const averages = creditResults.annualAverages;
      const results = creditResults.employmentIncreaseResults;
      
      let youthRate = 0;
      let otherRate = 0;
      if (settings.size === 'small') {
          if (settings.region === 'capital') { youthRate = 1100; otherRate = 700; } 
          else { youthRate = 1200; otherRate = 770; }
      } else if (settings.size === 'middle') {
          youthRate = 800; otherRate = 450;
      }
      youthRate *= 10000;
      otherRate *= 10000;

      const clawbacks = [];
      const years = [...new Set(results.map(r => r.year))].sort((a,b) => a-b);
      
      // 최근 5년에 해당하는 연도의 시작 기준 계산 (예: summaryYears 가 [2020, 2021, 2022, 2023, 2024]라면 2020년이 기준)
      // summaryYears 자체가 파일 하단에서 recentSummaryData를 통해 만들어짐에 따라 이를 직접 참조하기보다
      // averages(annualStats)의 최신 연도를 기준으로 5년 (최근 연도 - 4) 값을 추출하여 필터링합니다.
      const latestYear = Math.max(...averages.map(a => a.year));
      const minTargetYear = latestYear - 4;

      years.forEach(originYear => {
          if (originYear < minTargetYear) return; // 5년 이내 자료만 사후관리 필터링
          
          const originStat = averages.find(a => a.year === originYear);
          const originRes = results.find(r => r.year === originYear);
          if (!originStat || !originRes || !originRes.credit1st || originRes.credit1st <= 0) return;
          
          const maxAmount = originRes.credit1st;
          
          let clawbackY2 = 0;
          let y2Reason = '';
          const year2Stat = averages.find(a => a.year === originYear + 1);
          if (year2Stat) {
              const diffOverall = year2Stat.overallCount - originStat.overallCount;
              const diffYouth = year2Stat.youthCount - originStat.youthCount;
              if (diffOverall < 0) {
                  const appliedYouthDec = Math.min(Math.abs(diffOverall), Math.max(0, -diffYouth));
                  const appliedNormalDec = Math.abs(diffOverall) - appliedYouthDec;
                  clawbackY2 = (appliedYouthDec * youthRate) + (appliedNormalDec * otherRate);
                  y2Reason = '전체 인원 감소';
              } else if (diffYouth < 0) {
                  clawbackY2 = Math.abs(diffYouth) * (youthRate - otherRate);
                  y2Reason = '청년 인원 감소';
              }
              if (clawbackY2 > maxAmount) clawbackY2 = maxAmount;
          }
          
          let clawbackY3 = 0;
          let y3Reason = '';
          const year3Stat = averages.find(a => a.year === originYear + 2);
          if (year3Stat) {
              const diffOverall = year3Stat.overallCount - originStat.overallCount;
              const diffYouth = year3Stat.youthCount - originStat.youthCount;
              let totalClawback = 0;
              if (diffOverall < 0) {
                  const appliedYouthDec = Math.min(Math.abs(diffOverall), Math.max(0, -diffYouth));
                  const appliedNormalDec = Math.abs(diffOverall) - appliedYouthDec;
                  totalClawback = (appliedYouthDec * youthRate) + (appliedNormalDec * otherRate);
                  y3Reason = '전체 인원 감소';
              } else if (diffYouth < 0) {
                  totalClawback = Math.abs(diffYouth) * (youthRate - otherRate);
                  y3Reason = '청년 인원 감소';
              }
              if (totalClawback > maxAmount) totalClawback = maxAmount;
              clawbackY3 = Math.max(0, totalClawback - clawbackY2);
              if (clawbackY3 === 0) y3Reason = '';
          }
          
          if (clawbackY2 > 0 || clawbackY3 > 0) {
              clawbacks.push({
                  originYear,
                  clawbackY2,
                  y2Reason,
                  clawbackY3,
                  y3Reason,
                  year2: originYear + 1,
                  year3: originYear + 2
              });
          }
      });
      return clawbacks;
  };

  // Subtle diagonal pattern style
  const patternStyle = {
      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 11px)'
  };

  // --- Sub-Components ---
  // Reusable 'Lifted' Year Tabs Component
  const YearTabs = ({ data, children }) => {
      const uniqueYears = [...new Set(data.map(d => d.year))].sort((a,b) => b - a);
      const [currentYear, setCurrentYear] = useState(uniqueYears.length > 0 ? uniqueYears[0].toString() : null);

      if (uniqueYears.length === 0) return null;

      return (
          <div className="tabs tabs-lift">
              {uniqueYears.map(year => (
                  <React.Fragment key={year}>
                      <input 
                          type="radio" 
                          name={`year_tabs_${uniqueYears.join('_')}`} 
                          className="tab" 
                          aria-label={`${year}년`}
                          checked={currentYear === year.toString()}
                          onChange={() => setCurrentYear(year.toString())}
                      />
                      <div className="tab-content bg-base-100 border-base-300 rounded-box p-6">
                          {children(year, data.filter(d => d.year === year))}
                      </div>
                  </React.Fragment>
              ))}
          </div>
      );
  };




  // 2. Filtered Exclusions List
  const ExclusionList = () => {
      if (!processedData.some(d => d.exclusionReason)) return null;
      const allYears = [...new Set(processedData.map(d => d.year))].sort((a,b) => a-b);
      
      const excludedIds = new Set();
      const grouped = {};
      
      processedData.forEach(d => {
          if (d.exclusionReason) {
              excludedIds.add(d.id);
          }
      });

      processedData.forEach(d => {
          if (excludedIds.has(d.id)) { 
              if (!grouped[d.id]) {
                  grouped[d.id] = { name: d.name, id: d.id, hireDate: d.hireDate, retireDate: d.retireDate, years: {} };
              }
              grouped[d.id].years[d.year] = d;
          }
      });

      return (
          <div className="card bg-base-100 shadow-sm border border-base-200 mt-8">
              <div className="card-body p-6">
                  <h3 className="card-title text-base-content mb-4 flex items-center gap-2">
                      <span className="text-xl">🚫</span> 제외 대상자 명단
                  </h3>
                  <div className="overflow-x-auto">
                      <table className="table text-center">
                          <thead>
                              <tr>
                                  <th>이름</th>
                                  <th>인적 사항</th>
                                  {allYears.map(y => <th key={y}>{y}년</th>)}
                              </tr>
                          </thead>
                          <tbody>
                              {Object.values(grouped).map((person, idx) => (
                                  <tr key={idx} className="hover">
                                      <td className="font-bold">{person.name}</td>
                                      <td className="text-sm text-left opacity-60">
                                          <div className="font-mono">{person.id}</div>
                                      </td>
                                      {allYears.map(y => {
                                          const yearData = person.years[y];
                                          if (!yearData) return <td key={y} className="opacity-20">-</td>;
                                          const isExcluded = !!yearData.exclusionReason;
                                          return (
                                              <td key={y} className={`text-sm ${isExcluded ? 'text-error' : ''}`}>
                                                  {isExcluded && <div className="badge badge-sm badge-error badge-outline mb-1">{yearData.exclusionReason}</div>}
                                                  <div className="font-mono">{formatNumber(yearData.totalSalary)}</div>
                                              </td>
                                          );
                                      })}
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      );
  };


  // --- Helper for Summary Data ---
  const recentSummaryData = summaryData 
        ? [...summaryData].sort((a, b) => b.year - a.year).slice(0, 5).sort((a, b) => a.year - b.year)
        : [];
  const summaryYears = recentSummaryData.map(d => d.year);
  
  const getSummaryRows = () => {
       if (!recentSummaryData.length) return [];
       const rows = [
           { key: 'emp', category: '고용증대 세액공제' },
           { key: 'int', category: '통합고용 세액공제' },
           { key: 'soc', category: '사회보험료 세액공제' },
           { key: 'inc', category: '근로소득증대 세액공제' },
       ];
       return rows.map(row => {
           const rowData = { ...row, total: 0 };
           recentSummaryData.forEach(d => {
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
  const summaryRowsResult = getSummaryRows();
  const summaryTotalRow = (() => {
      const total = { total: 0 };
      recentSummaryData.forEach(d => {
          total[d.year] = summaryRowsResult.reduce((acc, r) => acc + (r[d.year] || 0), 0);
          total.total += total[d.year];
      });
      return total;
  })();


  if (processedData.length === 0) return null;

  return (
    <div className="space-y-6 animate-in fade-in pb-20" style={patternStyle}>
        
        {/* Header & Main Tabs */}
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end">
                <div>
                     <h2 className="text-2xl font-bold flex items-center gap-2">
                        <RiseOutlined className="text-primary" /> 세액공제 계산 리포트
                     </h2>
                </div>
                
                
                {/* Simplified Settings Display removed as requested */}
            </div>

            {/* Recalculate Button Area */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex justify-between items-center mb-6">
                  <div className="tabs tabs-box">
                      {[
                          { id: 'summary', icon: <FileTextOutlined />, label: '최종 집계' },
                          { id: 'integrated', icon: <TeamOutlined />, label: '통합고용' },
                          { id: 'employment', icon: <TeamOutlined />, label: '고용증대' },
                          { id: 'social', icon: <SafetyCertificateOutlined />, label: '사회보험' },
                          { id: 'income', icon: <DollarOutlined />, label: '근로소득' },
                      ].map(tab => (
                          <input 
                              key={tab.id}
                              defaultChecked={tab.id === 'summary'}
                              type="radio"
                              name="my_tabs_1"
                              className="tab"
                              aria-label={tab.label}
                              onChange={() => setActiveMainTab(tab.id)}
                          />
                      ))}
                  </div>
                  
                  {/* <button 
                      className="btn btn-primary btn-sm gap-2"
                      onClick={() => generateTaxCreditExcel(processedData, incomeIncreaseResults)}
                  >
                      <DownloadOutlined />
                      소명자료 다운로드 (Excel)
                  </button> */}
              </div>
                 
                 <div className="flex gap-2">
                     {activeMainTab === 'summary' && (
                         <div 
                            onClick={() => setShowClawback(!showClawback)}
                            className={`badge badge-lg h-10 px-4 cursor-pointer hover:scale-105 transition-transform font-bold border-none flex items-center gap-2 ${showClawback ? 'bg-error text-white' : 'bg-base-200 text-error'}`}
                         >
                            <span>⚠️ 사후관리 계산하기</span>
                         </div>
                     )}
                     <div 
                        onClick={handleRecalculate}
                        className={`badge badge-lg h-10 px-4 cursor-pointer hover:scale-105 transition-transform font-bold border-none text-white flex items-center gap-2 ${isCalculated ? 'bg-slate-700 shadow-md' : 'bg-primary shadow-lg animate-pulse'}`}
                     >
                        <CalculatorOutlined /> {isCalculated ? '재계산' : '변경사항 적용/재계산'}
                     </div>
                 </div>
            </div>
            
            {/* Settings Toggles (Badge Style) */}
            <div className="flex justify-end items-center gap-2">
                 <span className="text-sm font-bold opacity-40 mr-2">설정변경:</span>
                 <div className="flex items-center gap-1">
                     <div onClick={() => { setSettings({...settings, region: 'capital'}); setIsCalculated(false); }} 
                          className={`badge badge-lg cursor-pointer font-bold transition-all ${settings.region === 'capital' ? 'bg-slate-700 text-white border-none shadow-sm' : 'badge-outline text-base-content/40 hover:bg-base-200'}`}>
                         수도권
                     </div>
                     <div onClick={() => { setSettings({...settings, region: 'non-capital'}); setIsCalculated(false); }} 
                          className={`badge badge-lg cursor-pointer font-bold transition-all ${settings.region === 'non-capital' ? 'bg-slate-700 text-white border-none shadow-sm' : 'badge-outline text-base-content/40 hover:bg-base-200'}`}>
                         지방
                     </div>
                 </div>
                 <div className="w-px h-4 bg-base-300 mx-2"></div>
                 <div className="flex items-center gap-1">
                     <div onClick={() => { setSettings({...settings, size: 'small'}); setIsCalculated(false); }} 
                          className={`badge badge-lg cursor-pointer font-bold transition-all ${settings.size === 'small' ? 'bg-slate-700 text-white border-none shadow-sm' : 'badge-outline text-base-content/40 hover:bg-base-200'}`}>
                         중소
                     </div>
                     <div onClick={() => { setSettings({...settings, size: 'middle'}); setIsCalculated(false); }} 
                          className={`badge badge-lg cursor-pointer font-bold transition-all ${settings.size === 'middle' ? 'bg-slate-700 text-white border-none shadow-sm' : 'badge-outline text-base-content/40 hover:bg-base-200'}`}>
                         중견
                     </div>
                 </div>
            </div>
        </div>

        {/* --- TAB CONTENT AREA --- */}
        <div className="bg-base-100 min-h-[500px] p-4 md:p-8 rounded-box" style={patternStyle}>
            
            {/* TAB 1: SUMMARY */}
            {activeMainTab === 'summary' && summaryData && (
                <div className="space-y-8 animate-in fade-in">
                    {/* Final Summary Table */}
                    <div className="card shadow-sm bg-base-100 border border-base-200">
                        <div className="card-body p-0">
                            <div className="p-4 border-b border-base-200 bg-base-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg">📊 최종 집계표</h3>
                                <div className="badge badge-outline">최근 5년</div>
                            </div>
                            <div className="text-right text-sm text-base-content/60 px-4 py-2">단위: 원</div>
                            <table className="table table-zebra w-full text-center">
                                <thead>
                                    <tr>
                                        <th className="text-left pl-6">구분</th>
                                        {summaryYears.map(year => <th key={year}>{year}년</th>)}
                                        <th className="text-right pr-6 font-extrabold">5년 합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summaryRowsResult.map((row) => (
                                        <tr key={row.key} className="hover">
                                            <td className="text-left font-medium pl-6">{row.category}</td>
                                            {summaryYears.map(year => (
                                                <td key={year} className="font-mono opacity-70">
                                                    {row[year] > 0 ? formatNumber(row[year]) : <span className="opacity-20">-</span>}
                                                </td>
                                            ))}
                                            <td className="text-right font-bold pr-6 text-primary">
                                                {formatNumber(row.total)}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr className="bg-base-200/50 font-bold">
                                        <td className="text-left pl-6 py-4">총 세액공제액</td>
                                        {summaryYears.map(year => (
                                            <td key={year} className="font-mono text-primary">{formatNumber(summaryTotalRow[year])}</td>
                                        ))}
                                        <td className="text-right pr-6 text-lg text-primary">{formatNumber(summaryTotalRow.total)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* NEW: Clawback Table */}
                    {showClawback && (
                        <div className="card shadow-sm bg-base-100 border border-base-200 mt-8 mb-8">
                            <div className="card-body p-0">
                                <div className="p-4 border-b border-base-200 bg-error/10 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-error">⚠️ 사후관리(추징) 예상 내역</h3>
                                    <div className="badge badge-error badge-outline border-error">고용증대 기준</div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="table table-sm w-full text-center border-collapse">
                                        <thead>
                                            <tr className="bg-base-200/60 text-base-content border-b border-base-300">
                                                <th className="py-3">최초 공제연도</th>
                                                <th className="py-3">2차년도 추징 (원)</th>
                                                <th className="py-3">2차년도 사유</th>
                                                <th className="py-3">3차년도 추징 (원)</th>
                                                <th className="py-3">3차년도 사유</th>
                                                <th className="py-3 text-error font-extrabold">총 예상 추징액 (원)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getClawbackData().length > 0 ? getClawbackData().map((cb, idx) => (
                                                <tr key={idx} className="hover:bg-base-100 border-b border-base-200">
                                                    <td className="font-bold">{cb.originYear}년</td>
                                                    <td className="font-mono text-error">
                                                        {cb.clawbackY2 > 0 ? (
                                                            <div className="flex flex-col gap-1 items-center">
                                                                <span className="text-xs text-error font-bold tracking-tighter opacity-70">[{cb.year2}년]</span>
                                                                <span>{formatNumber(cb.clawbackY2)}</span>
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="text-xs opacity-70">{cb.y2Reason || '-'}</td>
                                                    <td className="font-mono text-error">
                                                        {cb.clawbackY3 > 0 ? (
                                                            <div className="flex flex-col gap-1 items-center">
                                                                <span className="text-xs text-error font-bold tracking-tighter opacity-70">[{cb.year3}년]</span>
                                                                <span>{formatNumber(cb.clawbackY3)}</span>
                                                            </div>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="text-xs opacity-70">{cb.y3Reason || '-'}</td>
                                                    <td className="font-mono font-bold text-error align-middle">
                                                        {formatNumber(cb.clawbackY2 + cb.clawbackY3)}
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan="6" className="py-8 text-center text-base-content/50">
                                                        추징 발생 예상 내역이 없습니다. (고용 인원 유지/증가)
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Comprehensive Tax Credit Plan Table (New Request) */}
                    <div className="card shadow-sm bg-base-100 border border-base-200 mt-8">
                        <div className="card-body p-0">
                             <div className="p-4 border-b border-base-200 bg-base-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg">📑 종합 세액공제 상세 계획</h3>
                                <div className="badge badge-primary badge-outline">상세 내역</div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="table table-sm w-full text-center border-collapse">
                                    <thead>
                                        <tr className="bg-base-200/60 text-base-content border-b border-base-300">
                                            <th className="border-r border-base-300 py-3 min-w-[120px]">구분</th>
                                            <th className="border-r border-base-300 py-3 min-w-[150px]">상세 항목</th>
                                            {summaryYears.map(year => (
                                                <th key={year} className="py-3 text-center border-r border-base-300 last:border-none font-bold">
                                                    {year}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* 1. Employment Increase Tax Credit */}
                                        {[
                                            { label: '1차(당해)년도 공제', key: 'credit1st', offset: 0 },
                                            { label: '2차년도 공제', key: 'credit2nd', offset: 1 },
                                            { label: '3차년도 공제', key: 'credit3rd', offset: 2 },
                                            { label: '2차년도 추징', key: 'clawback1', isClawback: true },
                                            { label: '3차년도 추징', key: 'clawback2', isClawback: true },
                                        ].map((row, idx, arr) => (
                                            <tr key={`emp-${idx}`} className={`hover:bg-base-100 border-b ${idx === arr.length - 1 ? 'border-b-2 border-base-content/30' : 'border-base-200'}`}>
                                                {idx === 0 && (
                                                    <td rowSpan={5} className="font-bold bg-base-100 border-r border-base-200 align-middle text-[14px]">
                                                        고용증대<br/>세액공제
                                                    </td>
                                                )}
                                                <td className="text-left pl-4 border-r border-base-200 text-sm font-medium bg-base-50/30">
                                                    {row.label}
                                                </td>
                                                {summaryYears.map(year => {
                                                    if (row.isClawback) {
                                                        return <td key={year} className="bg-base-200/20 border-r border-base-200 last:border-none"></td>;
                                                    }
                                                    
                                                    // Employment Increase Logic
                                                    const res = creditResults?.employmentIncreaseResults?.find(r => r.year === year);
                                                    const val = res ? res[row.key] : 0;
                                                     
                                                    // Color Logic
                                                    const getCycleColor = (originYear) => {
                                                        const colors = ['#F43099', '#615EFF', '#00D3BB', '#FCB700'];
                                                        return colors[(originYear) % 4];
                                                    };
                                                    const originYear = year - (row.offset || 0);
                                                    const color = val > 0 ? getCycleColor(originYear) : undefined;

                                                    return (
                                                        <td key={year} className="font-mono text-sm border-r border-base-200 last:border-none">
                                                            {val > 0 ? (
                                                                <span style={{ color, fontWeight: '700' }}>
                                                                    {formatNumber(val)}
                                                                </span>
                                                            ) : ''}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}

                                        {/* 2. Integrated Employment Tax Credit */}
                                        {[
                                            { label: '1차(당해)년도 공제', key: 'credit1st', offset: 0 },
                                            { label: '2차년도 공제', key: 'credit2nd', offset: 1 },
                                            { label: '3차년도 공제', key: 'credit3rd', offset: 2 },
                                            { label: '2차년도 추징', key: 'clawback1', isClawback: true },
                                            { label: '3차년도 추징', key: 'clawback2', isClawback: true },
                                            { label: '추가 공제세액', key: 'additional', isClawback: true }, // Placeholder
                                        ].map((row, idx, arr) => (
                                            <tr key={`int-${idx}`} className={`hover:bg-base-100 border-b ${idx === arr.length - 1 ? 'border-b-2 border-base-content/30' : 'border-base-200'}`}>
                                                {idx === 0 && (
                                                    <td rowSpan={6} className="font-bold bg-base-100 border-r border-base-200 align-middle text-[14px]">
                                                        통합고용<br/>세액공제
                                                    </td>
                                                )}
                                                <td className="text-left pl-4 border-r border-base-200 text-sm font-medium bg-base-50/30">
                                                    {row.label}
                                                </td>
                                                {summaryYears.map(year => {
                                                    // Integrated only applies 2023+ visually in rows if we want to follow strict logic, 
                                                    // but table structure asks for 2020-2024. Just display value if exists.
                                                    // However, integratedEmploymentResults usually filtered by year >= 2023.
                                                    
                                                    // Check if row is placeholder
                                                    if (row.isClawback) {
                                                         // Specific style for 'Additional Credit' which is positive? No, usually empty in this logic.
                                                         // But user asked to replicate image structure. 
                                                         // Image shows 'gray' for non-applicable. We can leave empty.
                                                         return <td key={year} className="bg-base-200/20 border-r border-base-200 last:border-none"></td>;
                                                    }
                                                    
                                                    const res = creditResults?.integratedEmploymentResults?.find(r => r.year === year);
                                                    const val = res ? res[row.key] : 0;
                                                    
                                                    // Image shows gray for pre-2023 in Integrated Section? 
                                                    // If year < 2023, basically no integrated credit. 
                                                    const isPreUnified = year < 2023;
                                                    
                                                    // Color Logic
                                                    const getCycleColor = (originYear) => {
                                                        const colors = ['#F43099', '#615EFF', '#00D3BB', '#FCB700'];
                                                        return colors[(originYear) % 4];
                                                    };
                                                    const originYear = year - (row.offset || 0);
                                                    const color = val > 0 ? getCycleColor(originYear) : undefined;

                                                    return (
                                                        <td key={year} className={`font-mono text-sm border-r border-base-200 last:border-none ${isPreUnified ? 'bg-base-200/30' : ''}`}>
                                                            {val > 0 ? (
                                                                <span style={{ color, fontWeight: '700' }}>
                                                                    {formatNumber(val)}
                                                                </span>
                                                            ) : ''}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}

                                        {/* 3. Social Insurance Tax Credit */}
                                        {[
                                            { label: '1차(당해)년도 공제', key: 'credit1st', offset: 0 },
                                            { label: '2차년도 공제', key: 'credit2nd', offset: 1 },
                                            { label: '2차년도 추징', key: 'clawback1', isClawback: true },
                                        ].map((row, idx, arr) => (
                                            <tr key={`soc-${idx}`} className={`hover:bg-base-100 border-b ${idx === arr.length - 1 ? 'border-b-2 border-base-content/30' : 'border-base-200'}`}>
                                                {idx === 0 && (
                                                    <td rowSpan={3} className="font-bold bg-base-100 border-r border-base-200 align-middle text-[14px]">
                                                        사회보험료<br/>세액공제
                                                    </td>
                                                )}
                                                <td className="text-left pl-4 border-r border-base-200 text-sm font-medium bg-base-50/30">
                                                    {row.label}
                                                </td>
                                                 {summaryYears.map(year => {
                                                    if (row.isClawback) {
                                                        return <td key={year} className="bg-base-200/20 border-r border-base-200 last:border-none"></td>;
                                                    }
                                                    
                                                    const res = socialInsuranceResults?.results?.find(r => r.year === year);
                                                    const val = res ? res[row.key] : 0;
                                                    
                                                    // Color Logic
                                                    const getCycleColor = (originYear) => {
                                                        const colors = ['#F43099', '#615EFF']; // Social Insurance uses 2 colors
                                                        return colors[(originYear) % 2];
                                                    };
                                                    const originYear = year - (row.offset || 0);
                                                    const color = val > 0 ? getCycleColor(originYear) : undefined;

                                                    return (
                                                        <td key={year} className="font-mono text-sm border-r border-base-200 last:border-none">
                                                            {val > 0 ? (
                                                                <span style={{ color, fontWeight: '700' }}>
                                                                    {formatNumber(val)}
                                                                </span>
                                                            ) : ''}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}

                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Excluded Executives List */}
                    <ExclusionList />

                    {/* Employee List (Full View) using Lifted Tabs */}
                    <div className="mt-8">
                         <h3 className="font-bold text-md mb-4 px-2">전체 사원 리스트 관리</h3>
                         <YearTabs data={processedData}>
                             {(year, yearData) => (
                                 <EmployeeListTable 
                                     yearData={yearData} 
                                     onUpdateExclusion={updateExclusion}
                                     formatNumber={formatNumber}
                                 />
                             )}
                         </YearTabs>
                    </div>
                </div>
            )}

            {/* TAB 2: INTEGRATED EMPLOYMENT (2023+) */}
            {activeMainTab === 'integrated' && creditResults && (
                <div className="space-y-8 animate-in fade-in">
                     {/* Calculation Result Table */}
                     <div className="card shadow-sm bg-base-100 border border-base-200">
                             <div className="card-body p-6">
                            <h3 className="card-title mb-6 flex items-center justify-between">
                                <span>💰 통합고용 세액공제 계산 결과 (2023년 이후)</span>
                                <div className="badge badge-ghost text-sm font-normal">청년 등 / 청년 외 구분</div>
                            </h3>
                            
                            <div className="overflow-x-auto">
                                <div className="text-right text-sm text-base-content/60 mb-1">단위: 원, 명</div>
                                <table className="table md:table-md w-full text-center">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} className="border-r border-base-200 text-center w-20">과세<br/>연도</th>
                                            <th colSpan={3} className="border-r border-base-200">상시근로자 수 (명)</th>
                                            <th colSpan={3} className="border-r border-base-200">총 급여 (원)</th>
                                            <th rowSpan={2} className="bg-base-200/30 font-bold min-w-[180px]">공제 요건 충족 여부</th>
                                        </tr>
                                        <tr>
                                            <th className="text-sm">청년 등</th>
                                            <th className="text-sm">청년 외</th>
                                            <th className="border-r border-base-200 font-bold text-sm">전체</th>
                                            <th className="text-primary text-sm">청년 급여</th>
                                            <th className="text-sm">청년 외 급여</th>
                                            <th className="border-r border-base-200 font-bold text-sm">전체 급여</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {creditResults.annualAverages.filter(stat => stat.year >= 2023).sort((a,b) => b.year - a.year).map((stat) => {
                                            const result = creditResults.integratedEmploymentResults.find(r => r.year === stat.year);
                                            const prevStat = creditResults.annualAverages.find(r => r.year === stat.year - 1);
                                            
                                            // Calculate YoY Differences
                                            const diffYouth = prevStat ? stat.youthCount - prevStat.youthCount : 0;
                                            const diffNormal = prevStat ? stat.normalCount - prevStat.normalCount : 0;
                                            const diffOverall = prevStat ? stat.overallCount - prevStat.overallCount : 0;

                                            const renderDiff = (val) => {
                                                if (!prevStat) return <span className="text-xs opacity-30 block">-</span>;
                                                if (Math.abs(val) < 0.01) return <span className="text-xs opacity-30 block">-</span>;
                                                const color = val > 0 ? 'text-primary' : 'text-error';
                                                const sign = val > 0 ? '+' : '';
                                                return <span className={`text-xs font-bold block ${color}`}>({sign}{val.toFixed(2)})</span>;
                                            };

                                            // Conditions Logic for Integrated Credit (Always Eligible if result exists basically, check specific fields)
                                            // The `calculateIntegratedCredit` function returns results only if eligible.
                                            const isNewEligible = result && result.credit1st > 0;
                                            const is2ndEligible = result && result.credit2nd > 0;
                                            const is3rdEligible = result && result.credit3rd > 0;

                                            return (
                                                <tr key={stat.year} className="hover text-sm">
                                                    <td className="font-bold bg-base-100">{stat.year}</td>
                                                    <td className="font-mono text-primary font-bold">
                                                        {stat.youthCount.toFixed(2)}
                                                        {renderDiff(diffYouth)}
                                                    </td>
                                                    <td className="font-mono">
                                                        {stat.normalCount.toFixed(2)}
                                                        {renderDiff(diffNormal)}
                                                    </td>
                                                    <td className="font-mono font-bold border-r border-base-200">
                                                        {stat.overallCount.toFixed(2)}
                                                        {renderDiff(diffOverall)}
                                                    </td>
                                                    <td className="font-mono text-sm text-primary/80">{formatNumber(stat.totalYouthSalary)}</td>
                                                    <td className="font-mono text-sm text-base-content">{formatNumber(stat.totalNormalSalary)}</td>
                                                    <td className="font-mono text-sm text-base-content font-bold border-r border-base-200">{formatNumber(stat.totalYouthSalary + stat.totalNormalSalary)}</td>
                                                    <td className="text-center p-2 align-middle">
                                                        {!isNewEligible && !is2ndEligible && !is3rdEligible ? (
                                                            <div className="text-sm opacity-40">
                                                                {diffOverall < 0 ? <span className="text-error">인원감소</span> : '공제정보 없음'}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-3 gap-0 border border-base-200 rounded-md overflow-hidden bg-white mx-auto max-w-[200px]">
                                                                {/* 1차 (신규) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 border-r border-base-200 ${isNewEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">1차(신규)</span>
                                                                    {isNewEligible ? 
                                                                        <div className="text-primary font-bold text-sm tracking-tight">증가</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                                {/* 2차 (유지) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 border-r border-base-200 ${is2ndEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">2차(유지)</span>
                                                                    {is2ndEligible ? 
                                                                        <div className="text-base-content font-bold text-sm tracking-tight">유지</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                                {/* 3차 (유지) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 ${is3rdEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">3차(유지)</span>
                                                                    {is3rdEligible ? 
                                                                        <div className="text-base-content font-bold text-sm tracking-tight">유지</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {creditResults.annualAverages.filter(stat => stat.year >= 2023).length === 0 && (
                                            <tr><td colSpan={8} className="py-10 text-center opacity-40">2023년 이후 데이터가 없습니다.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* [Integrated Employment] Transposed 3-Year Plan Table */}
                            <div className="mt-8">
                                <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                                    <span className="badge badge-primary badge-outline">상세</span> 3개년 공제 계획 (최근 5년)
                                </h4>
                                <div className="overflow-x-auto">
                                    <div className="text-right text-sm text-base-content/60 mb-1">단위: 원</div>
                                    <table className="table table-md w-full text-center bg-base-100 border border-base-200">
                                        <thead className="bg-base-200/50 text-sm">
                                            <tr>
                                                <th className="min-w-[100px] text-left pl-4">구분</th>
                                                {summaryYears.slice().sort((a,b) => a-b).map(year => (
                                                    <th key={year}>{year}년</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { label: '1차년도 (최초)', key: 'credit1st', offset: 0 },
                                                { label: '2차년도 (유지)', key: 'credit2nd', offset: 1 },
                                                { label: '3차년도 (유지)', key: 'credit3rd', offset: 2 },
                                                { label: '합 계', key: 'totalCredit', isTotal: true }
                                            ].map((row, rIdx) => (
                                                <tr key={rIdx} className={row.isTotal ? 'bg-base-200/30 font-bold' : 'hover text-sm'}>
                                                    <td className={`text-left pl-4 ${row.isTotal ? 'font-extrabold' : 'font-semibold'}`}>{row.label}</td>
                                                    {summaryYears.slice().sort((a,b) => a-b).map(year => {
                                                        const res = creditResults.integratedEmploymentResults.find(r => r.year === year) || { credit1st: 0, credit2nd: 0, credit3rd: 0, totalCredit: 0 };
                                                        const val = res[row.key] || 0;
                                                        
                                                        // Color Logic
                                                        const getCycleColor = (originYear) => {
                                                            const colors = ['#F43099', '#615EFF', '#00D3BB', '#FCB700'];
                                                            return colors[(originYear) % 4];
                                                        };
                                                        
                                                        // Origin year for this cell's credit: Current Year - Row Offset
                                                        // e.g., In 2024, 2nd year credit comes from 2023 origin.
                                                        const originYear = year - (row.offset || 0);
                                                        const color = (!row.isTotal && val > 0) ? getCycleColor(originYear) : undefined;

                                                        return (
                                                            <td key={year} className="font-mono">
                                                                {val > 0 ? (
                                                                    <span style={{ color, fontWeight: row.isTotal ? '800' : '700' }}>
                                                                        {formatNumber(val)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="opacity-20">-</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                         </div>
                      </div>
                     
                     {/* Regular Employee List */}
                     <div className="mt-8">
                         <h3 className="font-bold text-md mb-4 px-2">연도별 상시근로자 리스트</h3>
                          <YearTabs data={processedData.filter(d => d.year >= 2023)}>
                             {(year, yearData) => (
                                 <EmployeeListTable 
                                     yearData={yearData} 
                                     onUpdateExclusion={updateExclusion}
                                     formatNumber={formatNumber}
                                 />
                             )}
                         </YearTabs>
                     </div>
                </div>
            )}

            {/* TAB 3: EMPLOYMENT INCREASE (Old Logic, All Years) */}
            {activeMainTab === 'employment' && creditResults && (
                <div className="space-y-8 animate-in fade-in">
                     {/* Calculation Result Table */}
                     <div className="card shadow-sm bg-base-100 border border-base-200">
                             <div className="card-body p-6">
                            <h3 className="card-title mb-6 flex items-center justify-between">
                                <span>💰 고용증대 세액공제 계산 결과 (전체 연도)</span>
                                <div className="badge badge-ghost text-sm font-normal">청년 등 / 청년 외 구분</div>
                            </h3>
                            
                            <div className="overflow-x-auto">
                                <div className="text-right text-sm text-base-content/60 mb-1">단위: 원, 명</div>
                                <table className="table md:table-md w-full text-center">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} className="border-r border-base-200 text-center w-20">과세<br/>연도</th>
                                            <th colSpan={3} className="border-r border-base-200">상시근로자 수 (명)</th>
                                            <th colSpan={3} className="border-r border-base-200">총 급여 (원)</th>
                                            <th rowSpan={2} className="bg-base-200/30 font-bold min-w-[180px]">공제 요건 충족 여부</th>
                                        </tr>
                                        <tr>
                                            <th className="text-sm">청년 등</th>
                                            <th className="text-sm">청년 외</th>
                                            <th className="border-r border-base-200 font-bold text-sm">전체</th>
                                            <th className="text-primary text-sm">청년 급여</th>
                                            <th className="text-sm">청년 외 급여</th>
                                            <th className="border-r border-base-200 font-bold text-sm">전체 급여</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Show ALL years, but prioritize order */}
                                        {creditResults.annualAverages.sort((a,b) => b.year - a.year).map((stat) => {
                                            const result = creditResults.employmentIncreaseResults.find(r => r.year === stat.year);
                                            const prevStat = creditResults.annualAverages.find(r => r.year === stat.year - 1);
                                            
                                            // Calculate YoY Differences
                                            const diffYouth = prevStat ? stat.youthCount - prevStat.youthCount : 0;
                                            const diffNormal = prevStat ? stat.normalCount - prevStat.normalCount : 0;
                                            const diffOverall = prevStat ? stat.overallCount - prevStat.overallCount : 0;

                                            const renderDiff = (val) => {
                                                if (!prevStat) return <span className="text-xs opacity-30 block">-</span>;
                                                if (Math.abs(val) < 0.01) return <span className="text-xs opacity-30 block">-</span>;
                                                const color = val > 0 ? 'text-primary' : 'text-error';
                                                const sign = val > 0 ? '+' : '';
                                                return <span className={`text-xs font-bold block ${color}`}>({sign}{val.toFixed(2)})</span>;
                                            };

                                            // Conditions Logic
                                            const isNewEligible = result && result.credit1st > 0;
                                            const is2ndEligible = result && result.credit2nd > 0;
                                            const is3rdEligible = result && result.credit3rd > 0;

                                            return (
                                                <tr key={stat.year} className="hover text-sm">
                                                    <td className="font-bold bg-base-100">{stat.year}</td>
                                                    <td className="font-mono text-primary font-bold">
                                                        {stat.youthCount.toFixed(2)}
                                                        {renderDiff(diffYouth)}
                                                    </td>
                                                    <td className="font-mono">
                                                        {stat.normalCount.toFixed(2)}
                                                        {renderDiff(diffNormal)}
                                                    </td>
                                                    <td className="font-mono font-bold border-r border-base-200">
                                                        {stat.overallCount.toFixed(2)}
                                                        {renderDiff(diffOverall)}
                                                    </td>
                                                    <td className="font-mono text-sm text-primary/80">{formatNumber(stat.totalYouthSalary)}</td>
                                                    <td className="font-mono text-sm text-base-content">{formatNumber(stat.totalNormalSalary)}</td>
                                                    <td className="font-mono text-sm text-base-content font-bold border-r border-base-200">{formatNumber(stat.totalYouthSalary + stat.totalNormalSalary)}</td>
                                                    <td className="text-center p-2 align-middle">
                                                        {!isNewEligible && !is2ndEligible && !is3rdEligible ? (
                                                            <div className="text-sm opacity-40">
                                                                {diffOverall < 0 ? <span className="text-error">인원감소</span> : '공제정보 없음'}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-3 gap-0 border border-base-200 rounded-md overflow-hidden bg-white mx-auto max-w-[200px]">
                                                                {/* 1차 (신규) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 border-r border-base-200 ${isNewEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">1차(신규)</span>
                                                                    {isNewEligible ? 
                                                                        <div className="text-primary font-bold text-sm tracking-tight">증가</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                                {/* 2차 (유지) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 border-r border-base-200 ${is2ndEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">2차(유지)</span>
                                                                    {is2ndEligible ? 
                                                                        <div className="text-base-content font-bold text-sm tracking-tight">유지</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                                {/* 3차 (유지) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 ${is3rdEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">3차(유지)</span>
                                                                    {is3rdEligible ? 
                                                                        <div className="text-base-content font-bold text-sm tracking-tight">유지</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {creditResults.annualAverages.length === 0 && (
                                            <tr><td colSpan={8} className="py-10 text-center opacity-40">데이터가 없습니다.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* [Employment Increase] Transposed 3-Year Plan Table */}
                            <div className="mt-8">
                                <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                                    <span className="badge badge-primary badge-outline">상세</span> 3개년 공제 계획 (최근 5년)
                                </h4>
                                <div className="overflow-x-auto">
                                    <div className="text-right text-sm text-base-content/60 mb-1">단위: 원</div>
                                    <table className="table table-md w-full text-center bg-base-100 border border-base-200">
                                        <thead className="bg-base-200/50 text-sm">
                                            <tr>
                                                <th className="min-w-[100px] text-left pl-4">구분</th>
                                                {summaryYears.slice().sort((a,b) => a-b).map(year => (
                                                    <th key={year}>{year}년</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[
                                                { label: '1차년도 (최초)', key: 'credit1st', offset: 0 },
                                                { label: '2차년도 (유지)', key: 'credit2nd', offset: 1 },
                                                { label: '3차년도 (유지)', key: 'credit3rd', offset: 2 },
                                                { label: '합 계', key: 'totalCredit', isTotal: true }
                                            ].map((row, rIdx) => (
                                                <tr key={rIdx} className={row.isTotal ? 'bg-base-200/30 font-bold' : 'hover text-sm'}>
                                                    <td className={`text-left pl-4 ${row.isTotal ? 'font-extrabold' : 'font-semibold'}`}>{row.label}</td>
                                                    {summaryYears.slice().sort((a,b) => a-b).map(year => {
                                                        const res = creditResults.employmentIncreaseResults.find(r => r.year === year) || { credit1st: 0, credit2nd: 0, credit3rd: 0, totalCredit: 0 };
                                                        const val = res[row.key] || 0;
                                                        
                                                        // Color Logic
                                                        const getCycleColor = (originYear) => {
                                                            const colors = ['#F43099', '#615EFF', '#00D3BB', '#FCB700'];
                                                            return colors[(originYear) % 4];
                                                        };
                                                        const originYear = year - (row.offset || 0);
                                                        const color = (!row.isTotal && val > 0) ? getCycleColor(originYear) : undefined;

                                                        return (
                                                            <td key={year} className="font-mono">
                                                                {val > 0 ? (
                                                                    <span style={{ color, fontWeight: row.isTotal ? '800' : '700' }}>
                                                                        {formatNumber(val)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="opacity-20">-</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                         </div>
                      </div>
                     
                     {/* Regular Employee List */}
                     <div className="mt-8">
                         <h3 className="font-bold text-md mb-4 px-2">연도별 상시근로자 리스트</h3>
                          <YearTabs data={processedData}>
                             {(year, yearData) => (
                                 <EmployeeListTable 
                                     yearData={yearData} 
                                     onUpdateExclusion={updateExclusion}
                                     formatNumber={formatNumber}
                                 />
                             )}
                         </YearTabs>
                     </div>
                </div>
            )}

            {/* TAB 3: SOCIAL INSURANCE */}
            {activeMainTab === 'social' && socialInsuranceResults && (
                 <div className="space-y-8 animate-in fade-in">
                     
                     {/* 1. Social Insurance Calculation Table (Detailed Inputs) */}
                     <div className="card shadow-sm bg-base-100 border border-base-200">
                             <div className="card-body p-6">
                            <h3 className="card-title mb-6 flex items-center justify-between">
                                <span>🛡️ 사회보험료 세액공제 계산 결과</span>
                                <div className="badge badge-ghost text-sm font-normal">상시근로자 수 및 사회보험료 대상 급여</div>
                            </h3>
                            
                            <div className="overflow-x-auto">
                                <div className="text-right text-sm text-base-content/60 mb-1">단위: 원, 명</div>
                                <table className="table md:table-md w-full text-center">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} className="border-r border-base-200 text-center w-20">과세<br/>연도</th>
                                            <th colSpan={3} className="border-r border-base-200">상시근로자 수 (명)</th>
                                            <th colSpan={3} className="border-r border-base-200">사회보험료 대상 급여 (원)</th>
                                            <th rowSpan={2} className="bg-base-200/30 font-bold min-w-[140px]">공제 요건 충족 여부</th>
                                        </tr>
                                        <tr>
                                            <th className="text-sm">청년 등</th>
                                            <th className="text-sm">청년 외</th>
                                            <th className="border-r border-base-200 font-bold text-sm">전체</th>
                                            <th className="text-primary text-sm">청년 급여</th>
                                            <th className="text-sm">청년 외 급여</th>
                                            <th className="border-r border-base-200 font-bold text-sm">전체 급여</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {socialInsuranceResults.annualStats.sort((a,b) => b.year - a.year).slice(0, 6).map((stat) => {
                                            const result = socialInsuranceResults.results.find(r => r.year === stat.year);
                                            const prevStat = socialInsuranceResults.annualStats.find(r => r.year === stat.year - 1);
                                            
                                            // Calculate Increases Manually for Display Context
                                            const diffYouth = prevStat ? stat.youthCount - prevStat.youthCount : 0;
                                            const diffNormal = prevStat ? stat.normalCount - prevStat.normalCount : 0;
                                            const diffOverall = prevStat ? stat.overallCount - prevStat.overallCount : 0;

                                            const renderDiff = (val) => {
                                                if (!prevStat) return <span className="text-xs opacity-30 block">-</span>;
                                                if (Math.abs(val) < 0.01) return <span className="text-xs opacity-30 block">-</span>;
                                                const color = val > 0 ? 'text-primary' : 'text-error';
                                                const sign = val > 0 ? '+' : '';
                                                return <span className={`text-xs font-bold block ${color}`}>({sign}{val.toFixed(2)})</span>;
                                            };
                                            
                                            // Eligibility Logic (Matches Calculation)
                                            // 1st Year: Overall Increase > 0.
                                            
                                            const isNewEligible = result && result.credit1st > 0;
                                            const is2ndEligible = result && result.credit2nd > 0;

                                            return (
                                                <React.Fragment key={stat.year}>
                                                <tr className="hover text-sm">
                                                    <td className="font-bold bg-base-100">{stat.year}</td>
                                                    <td className="font-mono text-primary font-bold">
                                                        {stat.youthCount.toFixed(2)}
                                                        {renderDiff(diffYouth)}
                                                    </td>
                                                    <td className="font-mono">
                                                        {stat.normalCount.toFixed(2)}
                                                        {renderDiff(diffNormal)}
                                                    </td>
                                                    <td className="font-mono font-bold border-r border-base-200">
                                                        {stat.overallCount.toFixed(2)}
                                                        {renderDiff(diffOverall)}
                                                    </td>
                                                    <td className="font-mono text-sm text-primary/80">{formatNumber(stat.siYouthSalary)}</td>
                                                    <td className="font-mono text-sm opacity-40">{formatNumber(stat.siNormalSalary)}</td>
                                                    <td className="font-mono text-sm text-base-content font-bold border-r border-base-200">{formatNumber(stat.siTotalSalary)}</td>
                                                    
                                                    <td className="text-center p-2 align-middle">
                                                        {!isNewEligible && !is2ndEligible ? (
                                                            <div className="text-sm opacity-40">
                                                                {diffOverall < 0 ? <span className="text-error">인원감소</span> : '공제정보 없음'}
                                                            </div>
                                                        ) : (
                                                            <div className="grid grid-cols-2 gap-0 border border-base-200 rounded-md overflow-hidden bg-white mx-auto max-w-[140px]">
                                                                {/* 1차 (신규) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 border-r border-base-200 ${isNewEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">1차(신규)</span>
                                                                    {isNewEligible ? 
                                                                        <div className="text-primary font-bold text-sm tracking-tight">증가</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                                {/* 2차 (유지) */}
                                                                <div className={`flex flex-col items-center justify-center p-1.5 ${is2ndEligible ? 'bg-primary/5' : ''}`}>
                                                                    <span className="text-[9px] opacity-50 mb-0.5">2차(유지)</span>
                                                                    {is2ndEligible ? 
                                                                        <div className="text-base-content font-bold text-sm tracking-tight">유지</div> : 
                                                                        <div className="text-base-content/20 text-sm">-</div>
                                                                    }
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                         </div>
                      </div>

                      {/* 2. [Social Insurance] Transposed 2-Year Credit Plan */}
                      <div className="mt-8">
                            <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                                <span className="badge badge-primary badge-outline">상세</span> 2개년 공제 계획 (최근 5년)
                            </h4>
                            <div className="overflow-x-auto">
                                <div className="text-right text-sm text-base-content/60 mb-1">단위: 원</div>
                                <table className="table table-md w-full text-center bg-base-100 border border-base-200">
                                    <thead className="bg-base-200/50 text-sm">
                                        <tr>
                                            <th className="min-w-[100px] text-left pl-4">구분</th>
                                            {summaryYears.slice().sort((a,b) => a-b).map(year => (
                                                <th key={year}>{year}년</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { label: '1차년도 (신규)', key: 'credit1st', offset: 0 },
                                            { label: '2차년도 (유지)', key: 'credit2nd', offset: 1 },
                                            { label: '합 계', key: 'estimatedCredit', isTotal: true }
                                        ].map((row, rIdx) => (
                                            <tr key={rIdx} className={row.isTotal ? 'bg-base-200/30 font-bold' : 'hover text-sm'}>
                                                <td className={`text-left pl-4 ${row.isTotal ? 'font-extrabold' : 'font-semibold'}`}>{row.label}</td>
                                                {summaryYears.slice().sort((a,b) => a-b).map(year => {
                                                    const res = socialInsuranceResults.results.find(r => r.year === year) || { credit1st: 0, credit2nd: 0, estimatedCredit: 0 };
                                                    const val = res[row.key] || 0;
                                                    
                                                    // Color Logic
                                                    const getCycleColor = (originYear) => {
                                                        const colors = ['#F43099', '#615EFF'];
                                                        return colors[(originYear) % 2];
                                                    };
                                                    const originYear = year - (row.offset || 0);
                                                    const color = (!row.isTotal && val > 0) ? getCycleColor(originYear) : undefined;

                                                    return (
                                                        <td key={year} className="font-mono">
                                                            {val > 0 ? (
                                                                <span style={{ color, fontWeight: row.isTotal ? '800' : '700' }}>
                                                                    {formatNumber(val)}
                                                                </span>
                                                            ) : (
                                                                <span className="opacity-20">-</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>


                        {/* 3. Reference Table (Transposed & Full Width) */}
                        <div className="card bg-base-200/30 border border-base-200 mt-8">
                             <div className="card-body p-6">
                                 <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                                     <CalculatorOutlined /> 고용증대 사회보험료율표 (참고)
                                 </h4>
                                 <div className="overflow-x-auto">
                                     <table className="table table-xs w-full text-center bg-base-100 border border-base-200">
                                         <thead>
                                             <tr className="bg-base-200">
                                                 <th className="font-bold text-left pl-4 min-w-[100px]">구분</th>
                                                 {['2019', '2020', '2021', '2022', '2023', '2024'].map(y => <th key={y}>{y}년</th>)}
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {[
                                                 { label: '국민연금', values: ['4.50%', '4.500%', '4.500%', '4.500%', '4.500%', '4.500%'] },
                                                 { label: '건강보험', values: ['3.23%', '3.335%', '3.430%', '3.495%', '3.545%', '3.545%'] },
                                                 { label: '장기요양', values: ['0.274873%', '0.341850%', '0.395150%', '0.428850%', '0.454100%', '0.459100%'] },
                                                 { label: '고용(실업)', values: ['0.65%', '0.80%', '0.80%', '0.85%', '0.90%', '0.90%'] },
                                                 { label: '고용(안정)', values: ['0.25%', '0.25%', '0.25%', '0.25%', '0.25%', '0.25%'] },
                                                 { label: '산재(최저)', values: ['0.75%', '0.73%', '0.70%', '0.70%', '0.70%', '0.66%'] },
                                                 { label: '합 계', values: ['9.6548730%', '9.9568500%', '10.0751500%', '10.2238500%', '10.3491000%', '10.3141000%'], isTotal: true },
                                             ].map((row, idx) => (
                                                 <tr key={idx} className={row.isTotal ? 'bg-base-200/50 font-bold' : 'hover'}>
                                                     <td className={`text-left pl-4 ${row.isTotal ? 'text-primary' : ''}`}>{row.label}</td>
                                                     {row.values.map((val, i) => (
                                                         <td key={i} className={row.isTotal ? 'text-primary' : 'opacity-80'}>{val}</td>
                                                     ))}
                                                 </tr>
                                             ))}
                                         </tbody>
                                     </table>
                                 </div>
                             </div>
                        </div>

                     
                     
                     <div className="mt-8">
                         <h3 className="font-bold text-md mb-4 px-2">연도별 상시근로자 리스트</h3>
                         <YearTabs data={processedData}>
                             {(year, yearData) => (
                                 <EmployeeListTable 
                                     yearData={yearData} 
                                     onUpdateExclusion={updateExclusion}
                                     formatNumber={formatNumber}
                                 />
                             )}
                         </YearTabs>
                     </div>
                 </div>
            )}

            {/* TAB 4: INCOME INCREASE (HISTORICAL ANALYSIS) */}
            {activeMainTab === 'income' && incomeIncreaseResults && (
                <div className="space-y-10 animate-in fade-in">
                    
                     {/* Income Increase Comprehensive Summary */}
                     <div className="card shadow-sm bg-base-100 border border-base-200">
                         <div className="card-body p-6">
                             <h3 className="card-title text-lg mb-4 flex items-center gap-2">
                                <span>�</span> 근로소득증대 세액공제 종합 요약 (최근 5년)
                             </h3>
                             <div className="overflow-x-auto">
                                 {incomeIncreaseResults.results.length > 0 ? (
                                     <table className="table table-sm text-center w-full border border-base-200">
                                         <thead className="bg-base-200/50">
                                             <tr>
                                                 <th className="min-w-[120px] text-left pl-4 text-sm">구분</th>
                                                 {incomeIncreaseResults.results.sort((a,b) => b.year - a.year).slice(0, 5).sort((a,b) => a.year - b.year).map(res => (
                                                     <th key={res.year} className="text-sm">{res.year}년</th>
                                                 ))}
                                             </tr>
                                         </thead>
                                         <tbody>
                                             {/* Method Row */}
                                             <tr>
                                                 <td className="font-bold text-left pl-4 text-sm opacity-70">실제 적용 방식</td>
                                                 {incomeIncreaseResults.results.sort((a,b) => b.year - a.year).slice(0, 5).sort((a,b) => a.year - b.year).map(res => {
                                                     let methodLabel = '일반계산';
                                                     let badgeClass = 'badge-ghost';
                                                     if (res.calculationMethod === 'sme') { methodLabel = '중소기업 특례'; badgeClass = 'badge-primary'; }
                                                     else if (res.calculationMethod === 'special') { methodLabel = '계산특례'; badgeClass = 'badge-secondary'; }
                                                     return (
                                                         <td key={res.year}>
                                                             <div className={`badge badge-sm font-bold ${badgeClass} badge-outline whitespace-nowrap text-xs`}>
                                                                 {methodLabel}
                                                             </div>
                                                         </td>
                                                     );
                                                 })}
                                             </tr>
                                             {/* Rate Row */}
                                             <tr>
                                                 <td className="font-bold text-left pl-4 text-sm opacity-70">임금 증가율</td>
                                                 {incomeIncreaseResults.results.sort((a,b) => b.year - a.year).slice(0, 5).sort((a,b) => a.year - b.year).map(res => (
                                                     <td key={res.year} className="font-mono text-sm">
                                                         {res.rateT !== undefined && res.rateT !== null ? (
                                                             <span className={res.rateT > 0 ? 'text-success font-bold' : (res.rateT < 0 ? 'text-error font-bold' : 'text-base-content/50')}>
                                                                 {(res.rateT * 100).toFixed(2)}%
                                                             </span>
                                                         ) : '-'}
                                                     </td>
                                                 ))}
                                             </tr>
                                             {/* Excess Amount Row */}
                                             <tr>
                                                 <td className="font-bold text-left pl-4 text-sm opacity-70">공제 대상 초과액</td>
                                                 {incomeIncreaseResults.results.sort((a,b) => b.year - a.year).slice(0, 5).sort((a,b) => a.year - b.year).map(res => (
                                                     <td key={res.year} className="font-mono text-sm opacity-80">
                                                         {formatNumber(res.excessAmount)}
                                                     </td>
                                                 ))}
                                             </tr>
                                             {/* Final Credit Row */}
                                             <tr className="bg-primary/5 font-bold">
                                                 <td className="text-left pl-4 text-primary text-sm">최종 세액공제액</td>
                                                 {incomeIncreaseResults.results.sort((a,b) => b.year - a.year).slice(0, 5).sort((a,b) => a.year - b.year).map(res => (
                                                     <td key={res.year} className="font-mono text-primary text-sm">
                                                         {formatNumber(res.taxCredit)}
                                                     </td>
                                                 ))}
                                             </tr>
                                         </tbody>
                                     </table>
                                 ) : (
                                     <div className="text-center py-8 opacity-40 text-sm">계산된 공제 내역이 없습니다.</div>
                                 )}
                             </div>
                         </div>
                     </div>

                    
                     {incomeIncreaseResults.results.length === 0 && (
                        <div className="text-center py-20 opacity-50 border border-dashed border-base-300 rounded-box">
                            <div className="text-4xl mb-4">📉</div>
                            <p>근로소득증대 공제 발생 내역이 없습니다.</p>
                        </div>
                    )}

{/* Sub-component for individual Cohort Card to manage local state (Year Tabs) */}
                    {incomeIncreaseResults.results.sort((a,b) => b.year - a.year).map((record, idx) => (
                         <IncomeCohortCard key={record.year} record={record} formatNumber={formatNumber} />
                    ))}
                </div>
            )}

        </div>

    </div>
  );
}
