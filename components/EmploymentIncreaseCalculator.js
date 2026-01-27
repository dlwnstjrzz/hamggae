'use client';

import React, { useState } from 'react';
import { parseEmployeeData } from '@/utils/taxCorrection/employeeDataParser';

import { calculateEmploymentIncreaseCredit } from '@/utils/taxCorrection/employmentIncrease';
import { calculateSocialInsuranceClaims } from '@/utils/taxCorrection/socialInsurance';
import { calculateIncomeIncreaseCredit } from '@/utils/taxCorrection/incomeIncrease';

export default function EmploymentIncreaseCalculator() {
  const [processedData, setProcessedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  
  // Tax Credit Settings & Results
  const [settings, setSettings] = useState({ region: 'non-capital', size: 'small' });
  
  // Employment Increase Results
  const [creditResults, setCreditResults] = useState(null);

  // Social Insurance Results
  const [socialInsuranceResults, setSocialInsuranceResults] = useState(null);

  // Income Increase Results
  const [incomeIncreaseResults, setIncomeIncreaseResults] = useState(null);

  // Sorting & Filtering
  const [showYouthOnly, setShowYouthOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'youthMonths', direction: 'desc' }); // 기본값: 청년개월 내림차순

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setProcessedData([]);
    setActiveTab(null);
    setCreditResults(null); 
    setSocialInsuranceResults(null);
    setIncomeIncreaseResults(null);
    // Reset filters
    setSortConfig({ key: 'youthMonths', direction: 'desc' });
    setShowYouthOnly(false);

    try {
      const allYearsData = await parseEmployeeData(file);
      setProcessedData(allYearsData);
      
      const years = [...new Set(allYearsData.map(d => d.year))].sort((a,b) => b - a);
      if (years.length > 0) setActiveTab(years[0]);

    } catch (error) {
      console.error('Error processing excel:', error);
      alert('파일 처리 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCalculateCredit = () => {
      if (processedData.length === 0) return;
      const res = calculateEmploymentIncreaseCredit(processedData, settings);
      setCreditResults(res);
  };

  const handleCalculateSocialInsurance = () => {
    if (processedData.length === 0) return;
    // Assuming 'isNewGrowth' might be false for now unless user specifies
    const res = calculateSocialInsuranceClaims(processedData, { isNewGrowth: false }); 
    setSocialInsuranceResults(res);
  };

  const handleCalculateIncomeIncrease = () => {
      if (processedData.length === 0) return;
      const res = calculateIncomeIncreaseCredit(processedData, settings);
      setIncomeIncreaseResults(res);
  };

  const handleSort = (key) => {
      let direction = 'desc';
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
  };

  // Get unique years for tabs
  const availableYears = [...new Set(processedData.map(d => d.year))].sort((a,b) => a - b);
  
  // Apply Filter & Sort
  let filteredData = activeTab ? processedData.filter(d => d.year === activeTab) : [];
  
  if (showYouthOnly) {
      filteredData = filteredData.filter(d => d.youthMonths > 0);
  }

  if (sortConfig.key) {
      filteredData.sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
          if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }

  return (
    <div className="w-full space-y-8 mt-8">
      {/* 1. File Upload & Base Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">세액공제 분석 (고용증대 / 사회보험)</h2>
              <p className="text-gray-500 mt-1">
                '사원 통합표'를 업로드하여 고용증대 및 사회보험료 세액공제를 분석합니다.
              </p>
            </div>
            <div className="flex gap-3">
                <label className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer font-medium shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    통합표 업로드
                    <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
                </label>
            </div>
          </div>

          {/* Settings Panel */}
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex flex-wrap gap-8">
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">기업 구분</label>
                  <div className="flex gap-2">
                      <button 
                          onClick={() => setSettings({...settings, size: 'small'})}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${settings.size === 'small' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                      >
                          중소기업
                      </button>
                      <button 
                          onClick={() => setSettings({...settings, size: 'middle'})}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${settings.size === 'middle' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                      >
                          중견기업
                      </button>
                      <button 
                          onClick={() => setSettings({...settings, size: 'large'})}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${settings.size === 'large' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                      >
                          대기업/일반
                      </button>
                  </div>
              </div>
              
              <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">소재지</label>
                  <div className="flex gap-2">
                       <button 
                          onClick={() => setSettings({...settings, region: 'capital'})}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${settings.region === 'capital' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                      >
                          수도권 내
                      </button>
                      <button 
                          onClick={() => setSettings({...settings, region: 'non-capital'})}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${settings.region === 'non-capital' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                      >
                          수도권 외 (지방)
                      </button>
                  </div>
              </div>

              <div className="flex items-end gap-3 ml-auto">
                   <button 
                      onClick={handleCalculateCredit}
                      disabled={processedData.length === 0}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${
                        processedData.length > 0 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md hover:-translate-y-0.5' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                   >
                       고용증대 계산
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                   </button>

                   <button 
                      onClick={handleCalculateSocialInsurance}
                      disabled={processedData.length === 0}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${
                        processedData.length > 0 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md hover:-translate-y-0.5' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                   >
                       사회보험 계산
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                   </button>

                   <button 
                      onClick={handleCalculateIncomeIncrease}
                      disabled={processedData.length === 0}
                      className={`px-5 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${
                        processedData.length > 0 
                        ? 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-md hover:-translate-y-0.5' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                   >
                       근로소득 증대 계산
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                   </button>
              </div>
          </div>
      </div>

       {/* 2. Employee Table (Intermediate) */}
      {processedData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h3 className="text-lg font-bold text-gray-800">1. 연도별 사원 현황 (원천징수 기반)</h3>
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={showYouthOnly}
                            onChange={(e) => setShowYouthOnly(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        청년(만29세 이하)만 보기
                    </label>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    {availableYears.map(year => (
                        <button
                            key={year}
                            onClick={() => setActiveTab(year)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                                activeTab === year 
                                ? 'bg-white text-gray-900 shadow-sm' 
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {year}년
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="overflow-x-auto max-h-96 custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 font-medium sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3">No.</th>
                    <th className="px-4 py-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSort('name')}>성명 {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                    <th className="px-4 py-3">주민번호</th>
                    <th className="px-4 py-3">입사일</th>
                    <th className="px-4 py-3">퇴사일</th>
                    <th className="px-4 py-3 text-right cursor-pointer hover:bg-gray-100" onClick={() => handleSort('ageYearEnd')}>나이(연말) {sortConfig.key === 'ageYearEnd' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                    <th className="px-4 py-3 text-right">총급여</th>
                    
                    {/* 정렬 기능이 들어간 청년 개월 헤더 */}
                    <th 
                        className="px-4 py-3 text-center bg-blue-50 text-blue-700 cursor-pointer hover:bg-blue-100 transition-colors group"
                        onClick={() => handleSort('youthMonths')}
                    >
                        <div className="flex items-center justify-center gap-1">
                            청년 개월
                            {sortConfig.key === 'youthMonths' ? (
                                <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                            ) : (
                                <span className="opacity-0 group-hover:opacity-30">▼</span>
                            )}
                        </div>
                    </th>
                    
                      <th className="px-4 py-3 text-right bg-blue-50 text-blue-700">청년 급여</th>
                      <th className="px-4 py-3 text-center bg-gray-100">일반 개월</th>
                      <th className="px-4 py-3 text-right bg-gray-100">일반 급여</th>
                      
                      {/* Social Insurance Columns */}
                      <th className="px-4 py-3 text-right bg-indigo-50 text-indigo-700 border-l border-indigo-100">
                          <div className="flex flex-col items-center">
                              <span>사대보험 급여</span>
                              <span className="text-[10px] font-normal opacity-70">(퇴사월 제외)</span>
                          </div>
                      </th>
                      <th className="px-4 py-3 text-right bg-red-50 text-red-700">
                          <div className="flex flex-col items-center">
                              <span>차감 급여</span>
                              <span className="text-[10px] font-normal opacity-70">(중도퇴사)</span>
                          </div>
                      </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3 text-gray-500">{row.id}</td>
                      <td className="px-4 py-3 text-gray-500">{row.hireDate}</td>
                      <td className="px-4 py-3 text-gray-500">{row.retireDate}</td>
                      <td className="px-4 py-3 text-right">{row.ageYearEnd}세</td>
                      <td className="px-4 py-3 text-right font-medium">{row.totalSalary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center bg-blue-50/50 text-blue-700 font-bold">{row.youthMonths}</td>
                      <td className="px-4 py-3 text-right bg-blue-50/50 text-blue-700">{row.youthSalary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center bg-gray-50/50">{row.normalMonths}</td>
                      <td className="px-4 py-3 text-right bg-gray-50/50">{row.normalSalary.toLocaleString()}</td>
                      
                      {/* Social Insurance Data */}
                      <td className="px-4 py-3 text-right bg-indigo-50/50 text-indigo-700 font-medium border-l border-indigo-50">
                          {row.socialInsuranceTotalSalary.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right bg-red-50/50 text-red-600 text-xs">
                          {row.socialInsuranceExcludedSalary > 0 ? (
                              <div className="flex flex-col items-end">
                                  <span className="font-bold">-{row.socialInsuranceExcludedSalary.toLocaleString()}</span>
                                  <span className="text-[10px] text-red-400">({row.resignationExcludedMonth}월분)</span>
                              </div>
                          ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* 3. Tax Credit Calculation Results - Employment Increase */}
      {creditResults && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-lg font-bold text-gray-800 mb-6">2-A. 고용증대 세액공제 계산 결과</h3>
              
              {/* Annual Averages Table */}
              <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-500 mb-3 px-1">① 연도별 상시근로자 수 (월 평균)</h4>
                  <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
                      <table className="w-full text-sm text-center">
                          <thead className="bg-gray-50 text-gray-700">
                              <tr>
                                  <th className="px-6 py-3 border-r border-gray-200">연도</th>
                                  <th className="px-6 py-3 bg-blue-50/50 text-blue-800">청년 등 상시근로자</th>
                                  <th className="px-6 py-3">청년 외 상시근로자</th>
                                  <th className="px-6 py-3 font-bold bg-gray-100 text-gray-900 border-l border-gray-200">전체 상시근로자</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {creditResults.annualAverages.map((stat, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-6 py-3 font-medium text-gray-900 border-r border-gray-200">{stat.year}년</td>
                                      <td className="px-6 py-3 bg-blue-50/30 text-blue-700">
                                          <div className="flex flex-col items-center">
                                              <span className="font-bold text-lg">{stat.youthCount}명</span>
                                              <span className="text-xs text-blue-500">
                                                  ({stat.totalYouthMonths}개월 ÷ 12)
                                              </span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-3 text-gray-600">
                                          <div className="flex flex-col items-center">
                                              <span className="font-medium text-lg">{stat.normalCount}명</span>
                                              <span className="text-xs text-gray-400">
                                                  ({stat.totalNormalMonths}개월 ÷ 12)
                                              </span>
                                          </div>
                                      </td>
                                      <td className="px-6 py-3 font-bold bg-gray-50 border-l border-gray-200">
                                          <div className="flex flex-col items-center">
                                              <span className="text-lg">{stat.overallCount}명</span>
                                              <span className="text-xs text-gray-500">
                                                   ({stat.totalMonths}개월 ÷ 12)
                                              </span>
                                              <span className="text-[10px] text-gray-400 scale-90 origin-top">
                                                  *소수점 2자리 미만 절사
                                              </span>
                                          </div>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

               {/* Tax Credit Calculation Table */}
               <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-3 px-1">② 연도별 세액공제 산출 내역 (상세)</h4>
                  <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
                      <table className="w-full text-sm text-center">
                          <thead className="bg-gray-50 text-gray-700">
                              <tr>
                                  <th className="px-3 py-3 border-r border-gray-200" rowSpan={2}>연도</th>
                                  <th className="px-3 py-3 border-b border-gray-200 bg-blue-50/50 text-blue-800" colSpan={2}>청년 등 증가</th>
                                  <th className="px-3 py-3 border-b border-gray-200 bg-gray-50 text-gray-800" colSpan={2}>청년 외 증가</th>
                                  <th className="px-3 py-3 border-b border-gray-200" colSpan={3}>연차별 공제금액</th>
                                  <th className="px-4 py-3 border-l border-b border-gray-200 bg-emerald-50 text-emerald-800" rowSpan={2}>최종 공제세액</th>
                              </tr>
                              <tr>
                                  <th className="px-2 py-2 text-xs text-blue-700 bg-blue-50/30">인원(명)</th>
                                  <th className="px-2 py-2 text-xs text-blue-700 bg-blue-50/30 border-r border-gray-200">공제금액<br/><span className="text-[10px] text-blue-400 font-normal">(인원 × 단가)</span></th>
                                  
                                  <th className="px-2 py-2 text-xs text-gray-600 bg-gray-50">인원(명)</th>
                                  <th className="px-2 py-2 text-xs text-gray-600 bg-gray-50 border-r border-gray-200">공제금액<br/><span className="text-[10px] text-gray-400 font-normal">(인원 × 단가)</span></th>

                                  <th className="px-2 py-2 text-xs text-gray-500">1차년도</th>
                                  <th className="px-2 py-2 text-xs text-gray-500">2차년도</th>
                                  <th className="px-2 py-2 text-xs text-gray-500">3차년도</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {creditResults.results.map((res, idx) => {
                                  // Calculate individual amounts for display
                                  const youthAmount = res.youthIncreaseRecognized * res.youthRate * 10000;
                                  const otherAmount = res.otherIncreaseRecognized * res.otherRate * 10000;

                                  return (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-3 py-3 border-r border-gray-200 font-medium text-gray-900">
                                          {res.year}년
                                      </td>
                                      
                                      {/* Youth */}
                                      <td className="px-2 py-3 bg-blue-50/10 text-blue-700 font-medium">
                                          {res.youthIncreaseRecognized > 0 ? '+' : ''}{res.youthIncreaseRecognized}
                                      </td>
                                      <td className="px-2 py-3 bg-blue-50/10 text-blue-700 text-xs border-r border-gray-100">
                                          {youthAmount !== 0 ? (
                                              <div className="flex flex-col items-center">
                                                  <span>{youthAmount.toLocaleString()}</span>
                                                  <span className="text-[10px] text-blue-400">
                                                      ({res.youthRate.toLocaleString()}만)
                                                  </span>
                                              </div>
                                          ) : '-'}
                                      </td>

                                      {/* Other */}
                                      <td className="px-2 py-3 text-gray-600">
                                           {res.otherIncreaseRecognized > 0 ? '+' : ''}{res.otherIncreaseRecognized}
                                      </td>
                                      <td className="px-2 py-3 text-gray-500 text-xs border-r border-gray-100">
                                          {otherAmount !== 0 ? (
                                              <div className="flex flex-col items-center">
                                                  <span>{otherAmount.toLocaleString()}</span>
                                                  <span className="text-[10px] text-gray-400">
                                                      ({res.otherRate.toLocaleString()}만)
                                                  </span>
                                              </div>
                                          ) : '-'}
                                      </td>
                                      
                                      {/* Yearly credits */}
                                      <td className="px-2 py-3 text-gray-700 text-right text-xs">
                                          {res.credit1st.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-3 text-gray-500 text-right text-xs">
                                          {res.credit2nd.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-3 text-gray-400 text-right text-xs">
                                          {res.credit3rd.toLocaleString()}
                                      </td>

                                      <td className="px-4 py-3 font-bold bg-emerald-50/30 text-emerald-700 text-right border-l border-gray-200">
                                          {res.totalCredit.toLocaleString()}
                                      </td>
                                  </tr>
                                  );
                              })}
                              {creditResults.results.length === 0 && (
                                  <tr>
                                      <td colSpan={9} className="py-8 text-gray-400">계산 가능한 연도 구간이 없습니다.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
                   <p className="text-xs text-gray-400 mt-2 text-right">* 청년 등 단가: {settings.region === 'capital' ? '1,100' : '1,200'}만원, 청년 외 단가: {settings.region === 'capital' ? '700' : '770'}만원 (중소기업 기준 예시)</p>
              </div>
          </div>
      )}

      {/* 4. Tax Credit Calculation Results - Social Insurance */}
      {socialInsuranceResults && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-bold text-gray-800 mb-6">2-B. 사회보험료 세액공제 계산 결과</h3>

            {/* Annual Averages Table (Social Insurance Specific) */}
             <div className="mb-8">
                  <h4 className="text-sm font-semibold text-gray-500 mb-3 px-1">① 연도별 상시근로자 수 & 부담 사회보험료</h4>
                  <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
                      <table className="w-full text-sm text-center">
                          <thead className="bg-gray-50 text-gray-700">
                              <tr>
                                  <th className="px-4 py-3 border-r border-gray-200" rowSpan={2}>연도</th>
                                  <th className="px-4 py-3 bg-blue-50/50 text-blue-800 border-b border-gray-200" colSpan={2}>청년</th>
                                  <th className="px-4 py-3 bg-gray-50 text-gray-800 border-b border-gray-200" colSpan={2}>청년 외</th>
                                  <th className="px-4 py-3 font-bold bg-gray-100 text-gray-900 border-l border-b border-gray-200" rowSpan={2}>전체 인원</th>
                              </tr>
                              <tr>
                                  <th className="px-2 py-2 text-xs bg-blue-50/30 text-blue-700">인원</th>
                                  <th className="px-2 py-2 text-xs bg-blue-50/30 text-blue-700 border-r border-gray-200">총 사회보험 급여</th>
                                  
                                  <th className="px-2 py-2 text-xs bg-gray-50 text-gray-600">인원</th>
                                  <th className="px-2 py-2 text-xs bg-gray-50 text-gray-600 border-r border-gray-200">총 사회보험 급여</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {socialInsuranceResults.annualStats.map((stat, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">{stat.year}년</td>
                                      
                                      <td className="px-4 py-3 bg-blue-50/30 text-blue-700 font-medium">
                                          {stat.youthCount}명
                                      </td>
                                      <td className="px-4 py-3 bg-blue-50/30 text-blue-700 text-xs text-right border-r border-gray-100">
                                          {stat.siYouthSalary.toLocaleString()}원
                                      </td>

                                      <td className="px-4 py-3 text-gray-600 font-medium">
                                          {stat.normalCount}명
                                      </td>
                                      <td className="px-4 py-3 text-gray-600 text-xs text-right border-r border-gray-200">
                                          {stat.siNormalSalary.toLocaleString()}원
                                      </td>

                                      <td className="px-4 py-3 font-bold bg-gray-50 border-l border-gray-200">
                                          {stat.overallCount}명
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
            </div>

            {/* Final Calculation Table */}
            <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-3 px-1">② 연도별 공제세액 산출 내역</h4>
                  <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
                      <table className="w-full text-sm text-center">
                          <thead className="bg-gray-50 text-gray-700">
                              <tr>
                                  <th className="px-3 py-3 border-r border-gray-200" rowSpan={2}>연도</th>
                                  <th className="px-3 py-3 border-b border-gray-200 bg-blue-50/50 text-blue-800" colSpan={3}>청년 등 증가분</th>
                                  <th className="px-3 py-3 border-b border-gray-200 bg-gray-50 text-gray-800" colSpan={3}>청년 외 증가분</th>
                                  <th className="px-3 py-3 border-b border-gray-200" colSpan={2}>추가 공제</th>
                                  <th className="px-4 py-3 border-l border-b border-gray-200 bg-emerald-50 text-emerald-800" rowSpan={2}>최종 공제세액</th>
                              </tr>
                              <tr>
                                  {/* Youth */}
                                  <th className="px-2 py-2 text-xs text-blue-700 bg-blue-50/30">증가인원</th>
                                  <th className="px-2 py-2 text-xs text-blue-700 bg-blue-50/30">1인 부담액</th>
                                  <th className="px-2 py-2 text-xs text-blue-700 bg-blue-50/30 border-r border-gray-200">공제액</th>
                                  
                                  {/* Others */}
                                  <th className="px-2 py-2 text-xs text-gray-600 bg-gray-50">증가인원</th>
                                  <th className="px-2 py-2 text-xs text-gray-600 bg-gray-50">1인 부담액</th>
                                  <th className="px-2 py-2 text-xs text-gray-600 bg-gray-50 border-r border-gray-200">공제액</th>

                                  {/* 2nd Year */}
                                  <th className="px-2 py-2 text-xs text-gray-500">2차년도</th>
                                  <th className="px-2 py-2 text-xs text-gray-500 border-r border-gray-200">-</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {socialInsuranceResults.results.map((res, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-3 py-3 border-r border-gray-200 font-medium text-gray-900">
                                          {res.year}년
                                      </td>
                                      
                                      {/* Youth */}
                                      <td className="px-2 py-3 bg-blue-50/10 text-blue-700 font-medium">
                                          {res.recognizedYouthIncrease > 0 ? '+' : ''}{res.recognizedYouthIncrease}
                                      </td>
                                      <td className="px-2 py-3 bg-blue-50/10 text-blue-700 text-xs">
                                          {res.youthBurdenPerPerson.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-3 bg-blue-50/10 text-blue-700 font-medium text-right border-r border-gray-100">
                                          {res.youthCredit.toLocaleString()}
                                      </td>

                                      {/* Other */}
                                      <td className="px-2 py-3 text-gray-600">
                                           {res.recognizedNormalIncrease > 0 ? '+' : ''}{res.recognizedNormalIncrease}
                                      </td>
                                      <td className="px-2 py-3 text-gray-600 text-xs">
                                          {res.normalBurdenPerPerson.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-3 text-gray-600 font-medium text-right border-r border-gray-100">
                                          {res.normalCredit.toLocaleString()}
                                      </td>
                                      
                                      {/* 2nd Year */}
                                      <td className="px-2 py-3 text-gray-500 text-right text-xs">
                                          {res.support2ndYear.toLocaleString()}
                                      </td>
                                      <td className="px-2 py-3 text-gray-400 text-center">-</td>

                                      <td className="px-4 py-3 font-bold bg-emerald-50/30 text-emerald-700 text-right border-l border-gray-200">
                                          {res.totalCredit.toLocaleString()}
                                      </td>
                                  </tr>
                              ))}
                              {socialInsuranceResults.results.length === 0 && (
                                  <tr>
                                      <td colSpan={10} className="py-8 text-gray-400">공제 가능한 연도가 없습니다.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-right">* 청년 외 공제율: 50% (신성장 75%). 2차년도는 상시근로자 수 유지 시 1차년도 공제액 추가 지원.</p>
            </div>
        </div>
      )}

      {/* 5. Tax Credit Calculation Results - Income Increase */}
      {incomeIncreaseResults && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="text-lg font-bold text-gray-800 mb-6">2-C. 근로소득 증대 세액공제 계산 결과</h3>
            
            <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
               <table className="w-full text-sm text-center">
                   <thead className="bg-gray-50 text-gray-700">
                       <tr>
                           <th className="px-4 py-3 border-r border-gray-200">연도</th>
                           <th className="px-4 py-3 text-right">직전년도 상시수<br/><span className="text-[10px] font-normal text-gray-500">(공제대상 인원)</span></th>
                           <th className="px-4 py-3 text-right">해당연도 평균임금<br/><span className="text-[10px] font-normal text-gray-500">(퇴사자 등 제외)</span></th>
                           <th className="px-4 py-3 text-right">전년도 평균임금</th>
                           <th className="px-4 py-3 text-right text-blue-700">임금증가율</th>
                           <th className="px-4 py-3 text-right text-gray-500">직전 3년 평균율</th>
                           <th className="px-4 py-3 text-right bg-emerald-50 text-emerald-800 font-bold">공제세액<br/><span className="text-[10px] font-normal opacity-70">(초과증가분 × 공제율)</span></th>
                       </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                       {incomeIncreaseResults.results.map((res, idx) => (
                           <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">{res.year}년</td>
                                <td className="px-4 py-3 text-right">{res.employeeCountPre.toFixed(2)}명</td>
                                <td className="px-4 py-3 text-right">{res.avgWageT.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                <td className="px-4 py-3 text-right text-gray-600">{res.avgWageT_1.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                <td className="px-4 py-3 text-right font-medium text-blue-600">{(res.rateT * 100).toFixed(2)}%</td>
                                <td className="px-4 py-3 text-right text-gray-500 uppercase">{(res.avgPrevRate * 100).toFixed(2)}%</td>
                                <td className="px-4 py-3 text-right bg-emerald-50/50 text-emerald-700 font-bold">
                                    <div className="flex flex-col items-end">
                                        <span>{res.taxCredit.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                                        {res.excessAmount > 0 && <span className="text-[10px] text-emerald-500 opacity-80">(초과분: {res.excessAmount.toLocaleString(undefined, {maximumFractionDigits:0})})</span>}
                                    </div>
                                </td>
                           </tr>
                       ))}
                        {incomeIncreaseResults.results.length === 0 && (
                           <tr><td colSpan={7} className="py-8 text-gray-400">계산 가능한 구간이 없습니다 (직전 4년 포함 최소 5개년 데이터 필요)</td></tr>
                       )}
                   </tbody>
               </table>
            </div>
            
            {/* Excluded Employees List */}
            {incomeIncreaseResults.results.some(r => r.excludedEmployees && r.excludedEmployees.length > 0) && (
                <div className="mt-8">
                    <h4 className="text-sm font-semibold text-gray-500 mb-3 px-1">제외 대상자 목록 (총급여 7천만원 초과 또는 5년내 퇴사자)</h4>
                    <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-2 border-r border-gray-200">연도</th>
                                    <th className="px-4 py-2 border-r border-gray-200">성명</th>
                                    <th className="px-4 py-2 border-r border-gray-200">주민번호</th>
                                    <th className="px-4 py-2">제외 사유</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {incomeIncreaseResults.results.flatMap(yearResult => 
                                    yearResult.excludedEmployees.map((ex, i) => (
                                        <tr key={`${yearResult.year}-${i}`} className="hover:bg-gray-100">
                                            <td className="px-4 py-2 font-medium text-gray-700 border-r border-gray-200">{ex.year}년</td>
                                            <td className="px-4 py-2 text-gray-800 border-r border-gray-200">{ex.name}</td>
                                            <td className="px-4 py-2 text-gray-500 border-r border-gray-200">{ex.id}</td>
                                            <td className="px-4 py-2 text-red-600 text-xs">{ex.reason}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <p className="text-xs text-gray-400 mt-3 text-right">* 공제대상: 직전 3년 평균 임금증가율보다 높게 임금이 증가한 경우. (7천만원 이상 고액연봉자 및 퇴사자 제외 코호트 기준)</p>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      )}
    </div>
  );
}
