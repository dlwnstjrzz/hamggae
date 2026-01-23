'use client';

import React, { useState } from 'react';
import { parseEmployeeData } from '@/utils/taxCorrection/employeeDataParser';

import { calculateEmploymentIncreaseCredit } from '@/utils/taxCorrection/employmentIncrease';

export default function EmploymentIncreaseCalculator() {
  const [processedData, setProcessedData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  
  // Tax Credit Settings & Results
  const [settings, setSettings] = useState({ region: 'non-capital', size: 'small' });
  const [creditResults, setCreditResults] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsLoading(true);
    setProcessedData([]);
    setActiveTab(null);
    setCreditResults(null); 

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

  // Get unique years for tabs
  const availableYears = [...new Set(processedData.map(d => d.year))].sort((a,b) => a - b);
  const filteredData = activeTab ? processedData.filter(d => d.year === activeTab) : [];

  return (
    <div className="w-full space-y-8 mt-8">
      {/* 1. File Upload & Base Settings */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">고용증대 세액공제 분석</h2>
              <p className="text-gray-500 mt-1">
                '사원 통합표'를 업로드하여 청년 등 상시근로자 증가 여부를 분석합니다.
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

              <div className="flex items-end">
                   <button 
                      onClick={handleCalculateCredit}
                      disabled={processedData.length === 0}
                      className={`px-6 py-2.5 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center gap-2 ${
                        processedData.length > 0 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md hover:-translate-y-0.5' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                   >
                       세액공제 계산하기
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/></svg>
                   </button>
              </div>
          </div>
      </div>

       {/* 2. Employee Table (Intermediate) */}
      {processedData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">1. 연도별 사원 현황 (원천징수 기반)</h3>
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
                    <th className="px-4 py-3">성명</th>
                    <th className="px-4 py-3">주민번호</th>
                    <th className="px-4 py-3">입사일</th>
                    <th className="px-4 py-3">퇴사일</th>
                    <th className="px-4 py-3 text-right">나이(연말 기준)</th>
                    <th className="px-4 py-3 text-right">총급여</th>
                    <th className="px-4 py-3 text-center bg-blue-50 text-blue-700">청년 개월</th>
                    <th className="px-4 py-3 text-right bg-blue-50 text-blue-700">청년 급여</th>
                    <th className="px-4 py-3 text-center bg-gray-100">일반 개월</th>
                    <th className="px-4 py-3 text-right bg-gray-100">일반 급여</th>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        </div>
      )}

      {/* 3. Tax Credit Calculation Results */}
      {creditResults && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-lg font-bold text-gray-800 mb-6">2. 고용증대 세액공제 계산 결과</h3>
              
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
                                      <td className="px-6 py-3 bg-blue-50/30 text-blue-700 font-medium">{stat.youthCount}명</td>
                                      <td className="px-6 py-3 text-gray-600">{stat.normalCount}명</td>
                                      <td className="px-6 py-3 font-bold bg-gray-50 border-l border-gray-200">{stat.overallCount}명</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

               {/* Tax Credit Calculation Table */}
               <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-3 px-1">② 연도별 세액공제 산출 내역 (최근 5개년 합산)</h4>
                  <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
                      <table className="w-full text-sm text-center">
                          <thead className="bg-gray-50 text-gray-700">
                              <tr>
                                  <th className="px-3 py-3 border-r border-gray-200">연도</th>
                                  <th className="px-2 py-3 text-xs text-gray-500">전체증가</th>
                                  <th className="px-2 py-3 text-blue-700 bg-blue-50/50 text-xs">청년증가</th>
                                  <th className="px-2 py-3 text-gray-500 text-xs text-right border-r border-gray-100">청년외</th>
                                  <th className="px-3 py-3 text-gray-600">1차년도</th>
                                  <th className="px-3 py-3 text-gray-600">2차년도</th>
                                  <th className="px-3 py-3 text-gray-600 border-r border-gray-200">3차년도</th>
                                  <th className="px-4 py-3 font-bold bg-emerald-50 text-emerald-800">최종 공제세액</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {creditResults.results.map((res, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-3 py-3 border-r border-gray-200 font-medium text-gray-900">
                                          {res.year}년
                                      </td>
                                      <td className={`px-2 py-3 text-xs ${res.diffOverall >= 0 ? 'text-red-600 font-medium' : 'text-blue-600'}`}>
                                          {res.diffOverall > 0 ? '+' : ''}{res.diffOverall}
                                      </td>
                                      <td className="px-2 py-3 bg-blue-50/30 text-blue-700 font-medium text-xs">
                                          {res.youthIncreaseRecognized > 0 ? '+' : ''}{res.youthIncreaseRecognized}
                                      </td>
                                      <td className="px-2 py-3 text-gray-400 text-xs text-right border-r border-gray-100">
                                           {res.otherIncreaseRecognized > 0 ? '+' : ''}{res.otherIncreaseRecognized}
                                      </td>
                                      
                                      <td className="px-3 py-3 text-gray-700 text-right text-xs">
                                          {res.credit1st.toLocaleString()}
                                      </td>
                                      <td className="px-3 py-3 text-gray-500 text-right text-xs">
                                          {res.credit2nd.toLocaleString()}
                                      </td>
                                      <td className="px-3 py-3 text-gray-400 text-right border-r border-gray-200 text-xs">
                                          {res.credit3rd.toLocaleString()}
                                      </td>

                                      <td className="px-4 py-3 font-bold bg-emerald-50/30 text-emerald-700 text-right">
                                          {res.totalCredit.toLocaleString()}원
                                      </td>
                                  </tr>
                              ))}
                              {creditResults.results.length === 0 && (
                                  <tr>
                                      <td colSpan={8} className="py-8 text-gray-400">계산 가능한 연도 구간이 없습니다.</td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
                  </div>
                   <p className="text-xs text-gray-400 mt-2 text-right">* 1차년도 발생분 외에 사후관리를 통해 유지된 2차, 3차년도 공제액을 합산한 금액입니다.</p>
              </div>
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
