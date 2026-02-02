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
  const [expandedRow, setExpandedRow] = useState(null);

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
    setIsLoading(true);
    
    // Simulate async calculation
    setTimeout(() => {
        const results = calculateEmploymentIncreaseCredit(processedData, settings);
        setCreditResults(results);
        setIsLoading(false);
    }, 500);
  };

  const handleCalculateSocialInsurance = () => {
    if (processedData.length === 0) return;
    setIsLoading(true);
    setTimeout(() => {
        const results = calculateSocialInsuranceClaims(processedData); // No settings needed for now
        setSocialInsuranceResults(results);
        setIsLoading(false);
    }, 500);
  };

  const handleCalculateIncomeIncrease = () => {
    if (processedData.length === 0) return;
    setIsLoading(true);
    setTimeout(() => {
        const results = calculateIncomeIncreaseCredit(processedData, settings);
        setIncomeIncreaseResults(results);
        setIsLoading(false);
    }, 500);
  }

  // Helper to format currency
  const formatCurrency = (amount) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const getSortedData = (data) => {
      let filtered = [...data];
      if (showYouthOnly) {
        filtered = filtered.filter(emp => emp.isYouth);
      }

      return filtered.sort((a, b) => {
          if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
          if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  // Render nothing if no data
  if (processedData.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
        <input 
          type="file" 
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          className="hidden" 
          id="file-upload"
        />
        <label 
          htmlFor="file-upload"
          className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          엑셀 파일 업로드
        </label>
        <p className="mt-2 text-sm text-gray-500">
          근로소득지급명세서 엑셀 파일을 업로드하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">세액공제 계산기</h2>
          <p className="text-sm text-gray-500 mt-1">기업 설정 및 데이터 분석 결과</p>
        </div>
        
        <div className="flex items-center gap-4">
             {/* Settings Panel */}
             <div className="flex gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                <select 
                    value={settings.region}
                    onChange={(e) => setSettings({...settings, region: e.target.value})}
                    className="block rounded-md border-gray-300 py-1.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                >
                    <option value="capital">수도권</option>
                    <option value="non-capital">수도권 외</option>
                </select>
                <select 
                    value={settings.size}
                    onChange={(e) => setSettings({...settings, size: e.target.value})}
                    className="block rounded-md border-gray-300 py-1.5 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                >
                    <option value="small">중소기업</option>
                    <option value="middle">중견기업</option>
                    <option value="large">대기업</option>
                </select>
            </div>
            
            <div className="flex gap-2">
                 <button
                    onClick={handleCalculateCredit}
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${creditResults ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    고용증대 계산
                </button>
                 <button
                    onClick={handleCalculateSocialInsurance}
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 ${socialInsuranceResults ? 'bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                    사회보험료 계산
                </button>
                <button
                    onClick={handleCalculateIncomeIncrease}
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 ${incomeIncreaseResults ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                    근로소득증대 계산
                </button>
            </div>
        </div>
      </div>

      {/* Tabs for Years */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {processedData.map(yData => yData.year)
            .filter((value, index, self) => self.indexOf(value) === index) // Unique years
            .sort((a,b) => b - a)
            .map((year) => (
            <button
              key={year}
              onClick={() => setActiveTab(year)}
              className={`${
                activeTab === year
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {year}년 데이터 ({processedData.filter(d => d.year == year).length}명)
            </button>
          ))}
        </nav>
      </div>

      {/* Current Year Data View */}
      {activeTab && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
           <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">{activeTab}년도 근로자 목록</h3>
            <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2">
                     <label htmlFor="filter-youth" className="text-sm text-gray-700 font-medium">청년만 보기</label>
                     <input 
                        id="filter-youth"
                        type="checkbox" 
                        checked={showYouthOnly} 
                        onChange={(e) => setShowYouthOnly(e.target.checked)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                 </div>
            </div>
          </div>
          <div className="border-t border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">이름</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주민번호</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">입사일</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">퇴사일</th>
                  <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('totalSalary')}
                    >
                        총급여 {sortConfig.key === 'totalSalary' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </th>
                  <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('youthMonths')}
                    >
                        청년근무개월 {sortConfig.key === 'youthMonths' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                    </th>
                   <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                         onClick={() => handleSort('normalMonths')}
                    >
                      일반근무개월 {sortConfig.key === 'normalMonths' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getSortedData(processedData.filter(d => d.year == activeTab)).map((emp, idx) => (
                  <tr key={idx} className={emp.isYouth ? "bg-indigo-50/30" : ""}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.hireDate}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.retireDate || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(emp.totalSalary)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-bold">{emp.youthMonths}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.normalMonths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RESULT SECTION: Employment Increase Credit */}
      {creditResults && (
        <div className="mt-8 bg-white shadow sm:rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                💰 고용증대 세액공제 결과
                <span className="text-xs font-normal text-gray-500 px-2 py-1 bg-gray-100 rounded-md">
                    {settings.region === 'capital' ? '수도권' : '비수도권'} / {settings.size === 'small' ? '중소기업' : (settings.size === 'middle' ? '중견기업' : '대기업')}
                </span>
            </h3>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-500">
                    <thead className="bg-gray-50 text-gray-700 uppercase">
                        <tr>
                            <th className="px-4 py-3 border-b">연도</th>
                            <th className="px-4 py-3 border-b text-indigo-700">청년 등 상시근로자</th>
                            <th className="px-4 py-3 border-b text-gray-700">청년 외 상시근로자</th>
                            <th className="px-4 py-3 border-b text-gray-900 font-bold">전체 상시근로자</th>
                            <th className="px-4 py-3 border-b text-right">공제세액</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {creditResults.annualAverages.map((stat, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{stat.year}년</td>
                                <td className="px-4 py-3 text-indigo-600 font-medium">
                                    {stat.youthCount.toFixed(2)}명 
                                    <span className="text-xs text-gray-400 ml-1">
                                        ({idx < creditResults.annualAverages.length - 1 ? (stat.youthCount - creditResults.annualAverages[idx+1].youthCount).toFixed(2) : '-'})
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {stat.normalCount.toFixed(2)}명
                                     <span className="text-xs text-gray-400 ml-1">
                                        ({idx < creditResults.annualAverages.length - 1 ? (stat.normalCount - creditResults.annualAverages[idx+1].normalCount).toFixed(2) : '-'})
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-bold text-gray-900">
                                    {stat.overallCount.toFixed(2)}명
                                     <span className={`text-xs ml-1 ${ (idx < creditResults.annualAverages.length - 1 && (stat.overallCount - creditResults.annualAverages[idx+1].overallCount) >= 0) ? 'text-red-500' : 'text-blue-500'}`}>
                                        ({idx < creditResults.annualAverages.length - 1 ? (stat.overallCount - creditResults.annualAverages[idx+1].overallCount).toFixed(2) : '-'})
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-indigo-600">
                                    {creditResults.results.find(r => r.year === stat.year) ? formatCurrency(creditResults.results.find(r => r.year === stat.year).totalCredit) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {/* Detailed Calculation Logs (Optional/Expandable could be added here) */}
             <div className="mt-4 bg-gray-50 p-4 rounded-md text-xs text-gray-500 space-y-1">
                <p className="font-semibold mb-2">💡 계산 참고사항 (2025 개정 반영)</p>
                <p>• 청년 등 상시근로자: 15세 ~ 29세 (군복무기간 가산 시 최대 35세), 장애인, 60세 이상 등 포함.</p>
                <p>• 수도권 밖 중소기업 청년 공제액: 1인당 1,550만원 (2018~2020: 1,100~1,200만원)</p>
                <p>• 전체 상시근로자 수가 감소하지 않은 경우에만 공제 가능 (사후관리 요건 미반영 단순 산출)</p>
            </div>
        </div>
      )}

      {/* RESULT SECTION: Social Insurance Credit */}
      {socialInsuranceResults && (
        <div className="mt-8 bg-white shadow sm:rounded-lg border border-gray-200 p-6 border-l-4 border-l-emerald-500">
             <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                🛡️ 사회보험료 세액공제 결과
                <span className="text-xs font-normal text-gray-400 px-2 py-1 bg-gray-100 rounded-md">중소기업 특별세액감면 등 중복 불가 유의</span>
            </h3>

             <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left text-gray-500">
                    <thead className="bg-emerald-50 text-emerald-800 uppercase">
                        <tr>
                            <th className="px-4 py-3 border-b">연도</th>
                            <th className="px-4 py-3 border-b">청년 순증</th>
                            <th className="px-4 py-3 border-b">청년 외 순증</th>
                            <th className="px-4 py-3 border-b font-bold">공제 대상 인원</th>
                            <th className="px-4 py-3 border-b text-right">예상 공제세액 (50~100%)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                         {socialInsuranceResults.results.map((res, idx) => (
                             <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">{res.year}년</td>
                                <td className="px-4 py-3">{res.youthIncrease.toFixed(2)}명</td>
                                <td className="px-4 py-3">{res.normalIncrease.toFixed(2)}명</td>
                                <td className="px-4 py-3 font-bold text-emerald-700">{res.targetIncrease.toFixed(2)}명</td>
                                <td className="px-4 py-3 text-right font-bold underline decoration-emerald-300 decoration-2 underline-offset-2">
                                    {formatCurrency(res.estimatedCredit)}
                                </td>
                             </tr>
                         ))}
                    </tbody>
                </table>
            </div>
             <p className="text-xs text-gray-400 mt-2 text-right">* 공제율: 청년 100%, 청년 외 50% (신성장 서비스업 등 요건에 따라 다를 수 있음)</p>
        </div>
      )}

      {/* RESULT SECTION: Income Increase Credit */}
      {incomeIncreaseResults && (
         <div className="mt-8 bg-white shadow sm:rounded-lg border border-gray-200 p-6 border-l-4 border-l-orange-500">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                📈 근로소득증대 세액공제 결과
                 <span className="text-xs font-normal text-gray-500 px-2 py-1 bg-gray-100 rounded-md">
                    {settings.size === 'small' ? '공제율 20%' : (settings.size === 'middle' ? '공제율 10%' : '공제율 5%')}
                </span>
            </h3>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-center text-gray-600">
                    <thead className="bg-orange-50 text-orange-800 text-xs uppercase">
                         <tr>
                            <th rowSpan="2" className="px-4 py-3 border-r border-orange-200 align-middle">연도</th>
                            <th colSpan="2" className="px-4 py-2 border-b border-orange-200 bg-orange-100/50">직전 5년 무사고(퇴사X,고액X) 인원</th>
                            <th colSpan="2" className="px-4 py-2 border-b border-orange-200">평균임금(원)</th>
                            <th colSpan="5" className="px-4 py-2 border-b border-orange-200 bg-orange-100/50">임금증가율(%)</th>
                            <th className="px-4 py-3 text-right bg-emerald-50 text-emerald-800 font-bold text-xs">공제세액<br/><span className="text-[10px] font-normal opacity-70">(초과분 × 공제율)</span></th>
                        </tr>
                        <tr>
                            <th className="px-2 py-1 text-xs border-r border-orange-100 bg-orange-50">당해</th>
                            <th className="px-2 py-1 text-xs border-r border-orange-100 bg-orange-50">직전</th>
                            <th className="px-2 py-1 text-xs border-r border-orange-100">당해(T)</th>
                            <th className="px-2 py-1 text-xs border-r border-orange-100">직전(T-1)</th>
                            <th className="px-2 py-1 text-xs bg-orange-50 font-bold text-blue-600">당해(T)</th>
                            <th className="px-2 py-1 text-xs bg-orange-50">T-1</th>
                            <th className="px-2 py-1 text-xs bg-orange-50">T-2</th>
                            <th className="px-2 py-1 text-xs bg-orange-50">T-3</th>
                            <th className="px-2 py-1 text-xs bg-orange-50 font-bold border-l border-orange-200">3년평균</th>
                            <th className="px-4 py-3 text-right bg-emerald-50 text-emerald-800 font-bold text-xs">공제세액<br/><span className="text-[10px] font-normal opacity-70">(초과분 × 공제율)</span></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {incomeIncreaseResults.results.map((res, idx) => (
                            <React.Fragment key={idx}>
                                <tr className="hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100" onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}>
                                    <td className="px-4 py-3 font-medium text-gray-900 border-r border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${expandedRow === idx ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                            {res.year}년
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-blue-800 bg-blue-50/20 border-r border-blue-100">{res.employeeCountCurr.toFixed(2)}명</td>
                                    <td className="px-4 py-3 text-right border-r border-gray-100">{res.employeeCountPre.toFixed(2)}명</td>
                                    <td className="px-4 py-3 text-right">{res.avgWageT.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                    <td className="px-4 py-3 text-right text-gray-600">{res.avgWageT_1.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                    <td className="px-2 py-3 text-right font-medium text-blue-600">{(res.rateT * 100).toFixed(2)}%</td>
                                    <td className="px-2 py-3 text-right text-gray-500">{res.rates && res.rates.t1 !== null ? (res.rates.t1 * 100).toFixed(2)+'%' : '-'}</td>
                                    <td className="px-2 py-3 text-right text-gray-400">{res.rates && res.rates.t2 !== null ? (res.rates.t2 * 100).toFixed(2)+'%' : '-'}</td>
                                    <td className="px-2 py-3 text-right text-gray-400">{res.rates && res.rates.t3 !== null ? (res.rates.t3 * 100).toFixed(2)+'%' : '-'}</td>
                                    <td className="px-2 py-3 text-right font-bold border-l border-gray-200">
                                        <span className="text-gray-900">{(res.avgPrevRate * 100).toFixed(2)}%</span>
                                    </td>
                                    <td className="px-4 py-3 text-right bg-emerald-50/50 text-emerald-700 font-bold">
                                        <div className="flex flex-col items-end">
                                            <span>{res.taxCredit.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                                            {res.excessAmount > 0 && (
                                                <>
                                                    <span className="text-[10px] text-emerald-600 opacity-80 mt-1">
                                                        (초과분: {res.excessAmount.toLocaleString(undefined, {maximumFractionDigits:0})})
                                                    </span>
                                                    <div className="text-[9px] text-gray-400 font-normal mt-0.5 text-right leading-tight">
                                                        {res.employeeCountPre.toFixed(2)}명 × ({res.avgWageT.toLocaleString(undefined, {maximumFractionDigits:0})} - {res.avgWageT_1.toLocaleString(undefined, {maximumFractionDigits:0})}×{(1+res.avgPrevRate).toFixed(3)})
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                                {expandedRow === idx && res.history && (
                                    <tr className="bg-gray-50/50">
                                        <td colSpan={11} className="px-4 py-4 border-b border-gray-100">
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                                <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px]">{res.year}년 판단 기준</span>
                                                    코호트 과거 이력 데이터
                                                </h4>
                                                {res.calcDetails && (
                                                    <div className="mb-3 p-3 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 font-mono break-all leading-relaxed">
                                                        <span className="font-bold text-gray-800 block mb-1">🧮 산출식 ({res.excessAmount > 0 ? '공제대상' : '미대상'})</span> 
                                                        {res.calcDetails}
                                                        {res.calculationMethod !== 'sme' && ((res.smeExcessAmount && res.smeExcessAmount > 0) || (res.smeDesc && res.smeDesc.length > 0)) && (
                                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="badge bg-gray-100 text-gray-600 px-1 rounded text-[10px] border border-gray-300">비교</span>
                                                                    <span className="font-bold text-gray-700">중소기업특례 적용 시</span>
                                                                </div>
                                                                
                                                                <div className="pl-1 border-l-2 border-gray-300">
                                                                    {res.smeDesc}
                                                                    <div className="mt-0.5 font-bold text-gray-800">
                                                                        = {res.smeExcessAmount ? res.smeExcessAmount.toLocaleString() : 0}원
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="mt-2 text-gray-400 border-t border-dashed border-gray-200 pt-1">
                                                            * (당해 표준평균임금 - 직전 표준평균임금 × (1 + 증가율)) × 상시인원
                                                        </div>
                                                    </div>
                                                )}
                                                {res.smeRequirementsDesc && (
                                                    <div className={`mb-3 p-2 rounded border text-[11px] font-mono tracking-tight flex flex-col gap-1 ${res.smeConditionsMet ? 'bg-blue-50 border-blue-100 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                                                        <div className="flex items-center gap-2">
                                                             <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${res.smeConditionsMet ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                                                {res.smeConditionsMet ? '중소특례 요건 충족' : '중소특례 요건 미충족'}
                                                             </span>
                                                        </div>
                                                        {!res.smeConditionsMet && res.smeReason && (
                                                            <div className="text-red-500 text-[10px] font-bold">
                                                                * 사유: {res.smeReason}
                                                            </div>
                                                        )}
                                                        {res.smeRequirementsDesc}
                                                    </div>
                                                )}
                                                <div className="flex gap-4 overflow-x-auto pb-2">
                                                    {Object.entries(res.history).sort((a,b) => b[0] - a[0]).map(([year, stat]) => (
                                                        <div key={year} className={`flex-1 min-w-[120px] rounded p-3 border ${parseInt(year) === res.year || parseInt(year) === res.year - 1 ? 'bg-blue-50 border-blue-100 ring-1 ring-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                                                            <div className="flex justify-between items-center mb-2">
                                                                <div className={`text-sm font-bold ${parseInt(year) === res.year ? 'text-blue-700' : 'text-gray-600'}`}>{year}년</div>
                                                                {parseInt(year) === res.year && <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 rounded">당해</span>}
                                                                {parseInt(year) === res.year - 1 && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 rounded">직전</span>}
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-gray-500">평균임금</span>
                                                                    <span className="font-bold text-gray-900">{stat.avgWage.toLocaleString(undefined, {maximumFractionDigits:0})}</span>
                                                                </div>
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="text-gray-500">상시인원</span>
                                                                    <span className="font-medium text-gray-700">{stat.fte.toFixed(2)}</span>
                                                                </div>
                                                                    <div className="flex justify-between text-xs">
                                                                    <span className="text-gray-500">임금증가율</span>
                                                                    <span className={`font-medium ${stat.growthRate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                                        {stat.growthRate !== undefined ? (stat.growthRate * 100).toFixed(2) + '%' : '-'}
                                                                    </span>
                                                                </div>
                                                                {stat.names && stat.names.length > 0 && (
                                                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                                                        <p className="text-[10px] text-gray-400 mb-1">포함된 사원 ({stat.names.length}명)</p>
                                                                        <div className="text-[10px] text-gray-600 leading-tight break-keep">
                                                                            {stat.names.join(', ')}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-2">* 위 데이터는 {res.year}년 시점의 코호트(5년 내 퇴사자 제외 등) 기준으로 재산출된 값입니다.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        {incomeIncreaseResults.results.length === 0 && (
                            <tr><td colSpan={11} className="py-8 text-gray-400">표시할 데이터가 없습니다.</td></tr>
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
