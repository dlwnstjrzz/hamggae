import ExcelJS from 'exceljs';

export async function generateExcel(results) {
  console.log('[generateExcel] 엑셀 생성 시작');
  const workbook = new ExcelJS.Workbook();
  
  // 1. 데이터 분리
  const withholdingResults = results.filter(r => r.type === 'withholding');
  const registryResults = results.filter(r => r.type === 'registry');
  const taxReturnResults = results.filter(r => r.type === 'taxReturn');

  console.log(`[DEBUG_EXCEL] Results count: Total=${results.length}, Tax=${taxReturnResults.length}, Withholding=${withholdingResults.length}, Registry=${registryResults.length}`);
  taxReturnResults.forEach((r, i) => {
    console.log(`[DEBUG_EXCEL] TaxResult[${i}]: Year=${r.year}, TaxBase=${r.data?.taxBase}, CalculatedTax=${r.data?.calculatedTax}`);
  });

  // 1.5 임원 필터링 (등기부 임원은 원천징수부에서 제외)
  // [2026-02-20 Update] 사용자가 통합 자료 엑셀에는 임원도 포함되기를 원하므로 해당 필터링 무효화
  /*
  // 임원 재직 기간 정보 구축
  const executiveTenures = [];
  registryResults.forEach(reg => {
      reg.executives.forEach(exec => {
          const sortedHistory = [...exec.history].sort((a,b) => new Date(a.date) - new Date(b.date));
          if(sortedHistory.length === 0) return;
          
          let startDate = sortedHistory[0].date;
          let endDate = '9999-12-31'; // 현재 재직 중으로 간주
          
          // 마지막 기록이 퇴임 성격이면 종료일 설정
          const lastEvt = sortedHistory[sortedHistory.length-1];
          if(['사임','퇴임','만료','해임'].includes(lastEvt.type)) {
              endDate = lastEvt.date;
          }
          
          // 주민번호 앞자리 추출
          let juminFront = '';
          if (exec.id && exec.id.includes('-')) {
             juminFront = exec.id.split('-')[0];
          }

          executiveTenures.push({
              name: exec.name,
              juminFront: juminFront,
              start: startDate,
              end: endDate
          });
      });
  });

  // 원천징수부 데이터에서 임원 제거
  withholdingResults.forEach(res => {
      if(!res.year || res.year === 'Unknown') return;
      const targetYear = parseInt(res.year);
      const yearStart = `${targetYear}-01-01`;
      const yearEnd = `${targetYear}-12-31`;
      
      const originalCount = res.employees.length;
      res.employees = res.employees.filter(emp => {
          // 해당 사원의 주민번호 앞자리
          let empJuminFront = '';
          if (emp.주민등록번호 && emp.주민등록번호.includes('-')) {
              empJuminFront = emp.주민등록번호.split('-')[0];
          }
          
          // 임원 여부 확인 (이름 + 주민번호앞자리 + 기간 겹침)
          const isExec = executiveTenures.some(ex => {
              if (ex.name !== emp.성명) return false;
              // 주민번호 앞자리가 둘 다 존재하면 비교, 하나라도 없으면 이름만으로(위험하지만 fallback)
              if (ex.juminFront && empJuminFront && ex.juminFront !== empJuminFront) return false;
              
              // 기간 교집합 확인: (Start <= YearEnd) AND (End >= YearStart)
              return (ex.start <= yearEnd && ex.end >= yearStart);
          });
          
          if(isExec) {
              console.log(`[필터링] ${targetYear}년 원천징수부: 임원 '${emp.성명}' 제거 (재직기간: ${targetYear}년 포함)`);
              return false; // 제거
          }
          return true; // 유지
      });
      
      if (originalCount !== res.employees.length) {
          console.log(`-> ${targetYear}년 총 ${originalCount}명 중 ${originalCount - res.employees.length}명(임원) 제외됨.`);
      }
  });
  */

  // 2. 원천징수부 데이터 처리 (기존 로직)
  const dataByYear = {};
  const frontNumberGroups = {};
  const missingJuminList = [];
  const allYears = new Set(); // 등기부 필터링용 연도 집합

  withholdingResults.forEach(res => {
    let year = res.year;
    if (!year) year = 'Unknown';
    allYears.add(parseInt(year));
    
    if (!dataByYear[year]) dataByYear[year] = [];
    dataByYear[year].push(...res.employees);

    // 주민번호 분석을 위해 모든 사원 순회
    res.employees.forEach(emp => {
      const jumin = emp.주민등록번호 ? emp.주민등록번호.trim() : '';
      const name = emp.성명 || '(이름없음)';

      // 1. 주민번호 누락 체크
      // 정상 패턴: 6~7자리 숫자 + - + 6~7자리 (숫자 또는 *)
      const isValid = /^\d{6,7}-[\d*]{6,7}$/.test(jumin);
      
      if (!isValid) {
        missingJuminList.push({ year, name });
        return; // 누락자는 중복 검사에서 제외
      }

      // 2. * 포함된 주민번호 수집 (중복 처리용)
      if (jumin.includes('*')) {
        const frontPart = jumin.split('-')[0];
        
        if (!frontNumberGroups[frontPart]) {
          frontNumberGroups[frontPart] = {};
        }
        if (!frontNumberGroups[frontPart][name]) {
          frontNumberGroups[frontPart][name] = [];
        }
        // 해당 사원 객체 참조 저장 (나중에 수정하기 위해)
        frontNumberGroups[frontPart][name].push(emp);
      }
    });
  });
  
  // 법인세 신고서 연도도 allYears에 추가
  taxReturnResults.forEach(r => {
      if (r.year && r.year !== 'Unknown') allYears.add(parseInt(r.year));
  });

  // --- 주민번호 중복 처리 로직 ---
  const replacementDigits = ['0', '9', '8', '7', '6', '5', '4', '3', '2', '1'];
  const allChanges = [];

  for (const frontNum in frontNumberGroups) {
    const nameGroups = frontNumberGroups[frontNum];
    const names = Object.keys(nameGroups);

    if (names.length >= 2) {
      names.forEach((name, idx) => {
        if (idx < replacementDigits.length) {
          const digit = replacementDigits[idx];
          const employees = nameGroups[name]; 

          let originalJumin = '';
          let newJumin = '';

          employees.forEach(emp => {
            originalJumin = emp.주민등록번호;
            const parts = originalJumin.split('-');
            if (parts.length === 2) {
              const backPartLen = parts[1].length;
              newJumin = `${parts[0]}-${digit.repeat(backPartLen)}`;
              emp.주민등록번호 = newJumin; 
            }
          });

          if (originalJumin && newJumin) {
            allChanges.push({ name, jumin: newJumin });
          }
        }
      });
    }
  }

  // --- 시트 생성 시작 ---

  // 스타일 정의
  const headerStyle = {
    font: { bold: true },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  };
  const numberStyle = { numFmt: '#,##0', alignment: { vertical: 'middle', horizontal: 'right' } };
  const borderStyle = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

  // 1. 번호누락자 시트
  if (missingJuminList.length > 0) {
    const ws = workbook.addWorksheet('번호누락자');
    ws.columns = [
      { header: '연도', key: 'year', width: 10 },
      { header: '성명', key: 'name', width: 15 },
    ];
    missingJuminList.forEach(item => ws.addRow(item));
  }

  // 2. 동일앞번호 시트
  if (allChanges.length > 0) {
    const ws = workbook.addWorksheet('동일앞번호');
    ws.columns = [
      { header: '성명', key: 'name', width: 15 },
      { header: '주민등록번호', key: 'jumin', width: 20 },
    ];
    allChanges.forEach(item => ws.addRow(item));
  }

  // 3. 법인세신고서 (통합) 시트
  const sortedYears = Array.from(allYears).sort((a, b) => a - b).map(String);
  const hasTaxData = taxReturnResults.length > 0;
  const hasRegistryData = registryResults.length > 0;

  if (hasTaxData || hasRegistryData) {
      const wsTax = workbook.addWorksheet('법인세신고서');
      let currentRowIdx = 1;

      // [섹션 1] 등기부 기본 정보 (상호, 본점)
      if (hasRegistryData) {
          const repCompany = registryResults.find(r => r.companyName) || registryResults[0];
          const companyName = repCompany.companyName || '';
          const address = repCompany.address || '';
          const isCapitalArea = repCompany.isCapitalArea || false;

          wsTax.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
          wsTax.getCell(`A${currentRowIdx}`).value = '상 호 (등기부)';
          wsTax.getCell(`A${currentRowIdx}`).style = headerStyle;
          wsTax.mergeCells(`C${currentRowIdx}:D${currentRowIdx}`);
          wsTax.getCell(`C${currentRowIdx}`).value = companyName;
          
          currentRowIdx++;
          wsTax.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
          wsTax.getCell(`A${currentRowIdx}`).value = '소재지 구분';
          wsTax.getCell(`A${currentRowIdx}`).style = headerStyle;
          wsTax.mergeCells(`C${currentRowIdx}:D${currentRowIdx}`);
          wsTax.getCell(`C${currentRowIdx}`).value = isCapitalArea ? '수도권' : '비수도권';

          currentRowIdx++;
          wsTax.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
          wsTax.getCell(`A${currentRowIdx}`).value = '본 점 (등기부)';
          wsTax.getCell(`A${currentRowIdx}`).style = headerStyle;
          wsTax.mergeCells(`C${currentRowIdx}:H${currentRowIdx}`);
          wsTax.getCell(`C${currentRowIdx}`).value = address;
          
          currentRowIdx += 2; // 간격
      }

      // [섹션 2] 법인세 과세표준 및 주요 항목 (연도별 가로 배치)
      if (hasTaxData && sortedYears.length > 0) {
          const tableStartRow = currentRowIdx;
          const headers = ['구 분', ...sortedYears.map(y => `${y}년`)];
          
          const headerRow = wsTax.getRow(currentRowIdx);
          headerRow.values = headers;
          headerRow.eachCell(cell => cell.style = headerStyle);
          currentRowIdx++;

          const items = [
            { key: 'taxBase', label: '과세표준' },
            { key: 'calculatedTax', label: '산출세액' },
            { key: 'minTaxTarget', label: '최저한세 적용대상(감면세액)' },
            { key: 'deductedTax', label: '차감세액' },
            { key: 'totalAdjustment', label: '가감계' },
            { key: 'minTax', label: '최저한세' },
            { key: 'minTaxAdjustment', label: '최저한세 적용대상 공제 여분' }
          ];

          items.forEach(item => {
             const rowValues = [item.label];
             sortedYears.forEach(year => {
                 const targetRes = taxReturnResults.find(r => r.year == year);
                 if (targetRes) {
                     rowValues.push(targetRes.data[item.key]);
                 } else {
                     rowValues.push('');
                 }
             });
             const row = wsTax.getRow(currentRowIdx);
             row.values = rowValues;
             
             // 스타일링
             row.eachCell((cell, colNum) => {
                 cell.border = borderStyle;
                 if (colNum >= 2) cell.style = { ...cell.style, ...numberStyle };
                 else cell.alignment = { vertical: 'middle', horizontal: 'center' };
             });
             currentRowIdx++;
          });

          // 컬럼 너비 설정
          wsTax.getColumn(1).width = 30; // 구분 열
          sortedYears.forEach((_, idx) => {
              wsTax.getColumn(idx + 2).width = 15; // 연도 열
          });

          currentRowIdx += 2; // 간격

          // [섹션 3] 세액공제 명세서 (연도별 가로 배치)
          
          // 모든 연도에서 등장하는 세액공제 항목 수집 (이름 기준)
          const allCreditNames = new Set();
          taxReturnResults.forEach(res => {
              (res.data.taxCredits || []).forEach(credit => {
                  allCreditNames.add(credit.name);
              });
          });
          
          if (allCreditNames.size > 0) {
              const sortedCreditNames = Array.from(allCreditNames).sort();
              
              const creditHeaderRow = wsTax.getRow(currentRowIdx);
              creditHeaderRow.values = ['세액공제 구분(항목)', ...sortedYears.map(y => `${y}년`)];
              creditHeaderRow.eachCell(cell => cell.style = headerStyle);
              currentRowIdx++;

              sortedCreditNames.forEach(name => {
                  const rowValues = [name];
                  sortedYears.forEach(year => {
                      const targetRes = taxReturnResults.find(r => r.year == year);
                      let amount = '';
                      if (targetRes && targetRes.data.taxCredits) {
                          const credit = targetRes.data.taxCredits.find(c => c.name === name);
                          if (credit) amount = credit.amount;
                      }
                      rowValues.push(amount);
                  });

                  const row = wsTax.getRow(currentRowIdx);
                  row.values = rowValues;
                  
                  // 스타일링
                  row.eachCell((cell, colNum) => {
                      cell.border = borderStyle;
                      if (colNum >= 2) cell.style = { ...cell.style, ...numberStyle };
                      else cell.alignment = { vertical: 'middle', horizontal: 'left' };
                  });
                  currentRowIdx++;
              });
          }

          currentRowIdx += 2; // 간격

          // [섹션 4] 주식등변동상황(최대주주) 명세서
          
          // 4-1. 연도별 데이터 전파(Forward Fill) 로직
          const shareholderMap = {};
          let lastShareholders = [];
          
          // 연도 오름차순 순회
          sortedYears.forEach(year => {
              const res = taxReturnResults.find(r => r.year == year);
              
              // 해당 연도에 추출된 주주 명단이 있으면 갱신 (변동 발생)
              if (res && res.data && res.data.shareholders && res.data.shareholders.length > 0) {
                  lastShareholders = res.data.shareholders;
              }
              
              // 데이터가 있든 없든(전년도 복사), 해당 연도 데이터로 확정
              if (lastShareholders.length > 0) {
                  shareholderMap[year] = lastShareholders;
              }
          });

          // 4-2. 모든 연도에 등장하는 주주 목록 수집 (Union)
          const allShareholderKeys = new Set();
          const shareholderInfoMap = {}; // Key -> { name, relName, id }
          
          Object.values(shareholderMap).forEach(list => {
              list.forEach(sh => {
                  const key = `${sh.name}_${sh.id.split('-')[0]}`; // 이름_주민앞자리 로 식별
                  allShareholderKeys.add(key);
                  if (!shareholderInfoMap[key]) {
                      shareholderInfoMap[key] = { 
                          name: sh.name, 
                          relName: sh.relName, // 가장 최근 관계명 기준? (관계는 변할 수 있으나 일단 저장)
                          id: sh.id
                      };
                  }
              });
          });

          if (allShareholderKeys.size > 0) {
              const shareHeaderRow = wsTax.getRow(currentRowIdx);
              shareHeaderRow.values = ['주주명', '관계', ...sortedYears.map(y => `${y}년`)];
              shareHeaderRow.eachCell(cell => cell.style = headerStyle);
              currentRowIdx++;
              
              const sortedKeys = Array.from(allShareholderKeys).sort();

              sortedKeys.forEach(key => {
                  const info = shareholderInfoMap[key];
                  const rowValues = [info.name, info.relName || ''];
                  
                  sortedYears.forEach(year => {
                      const list = shareholderMap[year] || [];
                      const target = list.find(s => `${s.name}_${s.id.split('-')[0]}` === key);
                      
                      if (target) {
                          rowValues.push(`${target.ratio}%`);
                      } else {
                          rowValues.push('');
                      }
                  });
                  
                  const row = wsTax.getRow(currentRowIdx);
                  row.values = rowValues;
                  
                  row.eachCell((cell, colNum) => {
                      cell.border = borderStyle;
                      if (colNum >= 3) { // 3열부터(연도 데이터) 우측 정렬
                          cell.alignment = { vertical: 'middle', horizontal: 'right' };
                      } else {
                          cell.alignment = { vertical: 'middle', horizontal: 'center' };
                      }
                  });
                  currentRowIdx++;
              });
          }
      }
  }

  // 4. 임원명단 시트 (등기부 데이터 분리)
  if (registryResults.length > 0) {
    const wsExec = workbook.addWorksheet('임원명단');

    let minYear = Math.min(...allYears);
    let maxYear = Math.max(...allYears);
    
    // 만약 연도가 없으면(등기부만 넣은 경우) 임의로 넓게 잡거나 전체 출력
    if (allYears.size === 0) {
        minYear = 1900;
        maxYear = 3000;
    }

    console.log(`[임원명단] 필터링 기준: ${minYear} ~ ${maxYear}`);

    // 헤더 생성
    const headers = ['직위', '성명', '주민등록번호', '취임일', '사임/퇴임일', '재직기간'];
    const headerRow = wsExec.getRow(1);
    headerRow.values = headers;
    headerRow.eachCell(cell => cell.style = headerStyle);

    // 임원 데이터 병합 및 정제 로직 (기존 활용)
    const mergedExecutives = new Map();
    registryResults.forEach(reg => {
      reg.executives.forEach(exec => {
        const juminFront = exec.id.split('-')[0];
        const key = `${exec.name}_${juminFront}`;
        if (!mergedExecutives.has(key)) {
            mergedExecutives.set(key, { ...exec, history: [...exec.history] });
        } else {
            const existing = mergedExecutives.get(key);
            existing.history.push(...exec.history);
            if (existing.id.includes('*') && !exec.id.includes('*')) existing.id = exec.id;
            existing.position = exec.position;
        }
      });
    });

    const finalExecutives = Array.from(mergedExecutives.values()).map(exec => {
        const uniqueHistory = [];
        const seenEvents = new Set();
        exec.history.sort((a, b) => new Date(a.date) - new Date(b.date));
        exec.history.forEach(evt => {
            const key = `${evt.date}_${evt.type}`;
            if (!seenEvents.has(key)) {
                seenEvents.add(key);
                uniqueHistory.push(evt);
            }
        });
        
        // Start/End 재계산
        let startDate = null;
        let endDate = null;
        if (uniqueHistory.length > 0) {
            startDate = uniqueHistory[0].date;
            const lastEvent = uniqueHistory[uniqueHistory.length - 1];
            if (['사임', '퇴임', '만료', '해임'].includes(lastEvent.type)) endDate = lastEvent.date;
        }
        return { ...exec, history: uniqueHistory, startDate, endDate };
    });

    // 출력
    let rowIdx = 2;
    finalExecutives.forEach(exec => {
        // 연도 필터링
        const execStart = new Date(exec.startDate);
        const execEnd = exec.endDate ? new Date(exec.endDate) : new Date();
        const targetStart = new Date(`${minYear}-01-01`);
        const targetEnd = new Date(`${maxYear}-12-31`);

        if (execEnd < targetStart || execStart > targetEnd) return;

        const row = wsExec.getRow(rowIdx);
        row.values = [
            exec.position,
            exec.name,
            exec.id,
            exec.startDate,
            exec.endDate || '재직 중',
            `${exec.startDate} ~ ${exec.endDate || '현재'}`
        ];
        row.eachCell(cell => {
            cell.border = borderStyle;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        rowIdx++;
    });

    // 너비
    wsExec.columns = [
        { width: 15 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 15 }, { width: 30 }
    ];
  }

  // 5. 원천징수부 연도별 시트 (기존 로직)
  for (const year of Object.keys(dataByYear).sort()) {
    const employees = dataByYear[year];
    const working = [];
    const nonWorking = []; // 요청사항엔 없지만 기존 기능 유지

    employees.forEach(emp => {
      let isWorking = true;
      const targetYear = parseInt(year);
      if (!isNaN(targetYear)) {
        if (emp.입사일) {
           const hireYear = parseInt(emp.입사일.split('-')[0]);
           if (hireYear > targetYear) isWorking = false;
        }
        if (emp.퇴사일) {
           const retireYear = parseInt(emp.퇴사일.split('-')[0]);
           if (retireYear < targetYear) isWorking = false;
        }
      }
      if (isWorking) working.push(emp);
      else nonWorking.push(emp);
    });

    const addSheet = (sheetName, emps) => {
      const safeSheetName = sheetName.replace(/[\\/?*[\]]/g, '_').substring(0, 31);
      const worksheet = workbook.addWorksheet(safeSheetName);
      
      const headers = ['성명', '주민등록번호', '입사일', '퇴사일', '급여계', '상여계', '총급여액'];
      for (let i = 1; i <= 12; i++) headers.push(`${i}월 급여`);
      for (let i = 1; i <= 12; i++) headers.push(`${i}월 상여`);
      
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.style = headerStyle;
      });

      emps.forEach(emp => {
        const rowData = [
          emp.성명,
          emp.주민등록번호,
          emp.입사일,
          emp.퇴사일,
          emp.총급여액,
          emp.총상여액,
          emp.총급여액 + emp.총상여액
        ];
        for (let i = 1; i <= 12; i++) rowData.push(emp.monthly_salary[i]);
        for (let i = 1; i <= 12; i++) rowData.push(emp.monthly_bonus[i]);
        
        const row = worksheet.addRow(rowData);
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle;
          if (colNumber <= 4) cell.alignment = { vertical: 'middle', horizontal: 'center' };
          else cell.style = { ...cell.style, ...numberStyle };
        });
      });

      worksheet.columns.forEach((col, index) => {
          if (index === 0) col.width = 12; 
          else if (index === 1) col.width = 18;
          else if (index === 2 || index === 3) col.width = 12;
          else col.width = 12;
      });
    };

    if (working.length > 0) addSheet(year, working);
    if (nonWorking.length > 0) addSheet(`${year}(미근무)`, nonWorking);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  console.log('[generateExcel] 엑셀 생성 완료');
  return buffer;
}
