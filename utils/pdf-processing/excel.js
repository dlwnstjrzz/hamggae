import ExcelJS from 'exceljs';

export async function generateExcel(results) {
  console.log('[generateExcel] 엑셀 생성 시작');
  const workbook = new ExcelJS.Workbook();
  
  // 1. 데이터 분리
  const withholdingResults = results.filter(r => r.type === 'withholding');
  const registryResults = results.filter(r => r.type === 'registry');

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

  // --- 주민번호 중복 처리 로직 (Python 코드 이식) ---
  const replacementDigits = ['0', '9', '8', '7', '6', '5', '4', '3', '2', '1'];
  const allChanges = [];

  for (const frontNum in frontNumberGroups) {
    const nameGroups = frontNumberGroups[frontNum];
    const names = Object.keys(nameGroups);

    // 서로 다른 사람이 2명 이상인 경우만 처리
    if (names.length >= 2) {
      console.log(`  -> 동일 앞번호(${frontNum}) 발견: ${names.length}명`);
      
      names.forEach((name, idx) => {
        if (idx < replacementDigits.length) {
          const digit = replacementDigits[idx];
          const employees = nameGroups[name]; // 이 사람의 모든 연도 데이터

          // 모든 데이터 수정
          let originalJumin = '';
          let newJumin = '';

          employees.forEach(emp => {
            originalJumin = emp.주민등록번호;
            const parts = originalJumin.split('-');
            if (parts.length === 2) {
              const backPartLen = parts[1].length;
              newJumin = `${parts[0]}-${digit.repeat(backPartLen)}`;
              emp.주민등록번호 = newJumin; // 객체 직접 수정
            }
          });

          if (originalJumin && newJumin) {
            allChanges.push({ name, jumin: newJumin });
            console.log(`    -> ${name}: ${originalJumin} => ${newJumin}`);
          }
        }
      });
    }
  }

  // --- 시트 생성 시작 ---

  // 1. 번호누락자 시트 (맨 앞)
  if (missingJuminList.length > 0) {
    const wsMissing = workbook.addWorksheet('번호누락자');
    wsMissing.columns = [
      { header: '연도', key: 'year', width: 10 },
      { header: '성명', key: 'name', width: 15 },
    ];
    missingJuminList.forEach(item => wsMissing.addRow(item));
    console.log(`  -> 번호누락자 시트 생성: ${missingJuminList.length}명`);
  }

  // 2. 동일앞번호 시트 (맨 앞)
  if (allChanges.length > 0) {
    const wsChanges = workbook.addWorksheet('동일앞번호');
    wsChanges.columns = [
      { header: '성명', key: 'name', width: 15 },
      { header: '주민등록번호', key: 'jumin', width: 20 },
    ];
    allChanges.forEach(item => wsChanges.addRow(item));
    console.log(`  -> 동일앞번호 시트 생성: ${allChanges.length}명`);
  }

  // --- 시트 생성: 법인등기부 (New) ---
  if (registryResults.length > 0) {
    const wsRegistry = workbook.addWorksheet('법인등기부');
    
    let minYear, maxYear;
    if (allYears.size > 0) {
      minYear = Math.min(...allYears);
      maxYear = Math.max(...allYears);
      console.log(`[법인등기부] 필터링 기준 연도: ${minYear} ~ ${maxYear}`);
    } else {
      console.log(`[법인등기부] 원천징수부 연도 정보 없음 -> 전체 임원 이력 출력`);
    }

    // 헤더 스타일
    const headerStyle = {
      font: { bold: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } },
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    };

    // 1. 대표 상호 및 본점 정보 추출 (첫 번째 유효값 사용)
    const repCompany = registryResults.find(r => r.companyName) || registryResults[0];
    const companyName = repCompany.companyName || '';
    const address = repCompany.address || '';
    const isCapitalArea = repCompany.isCapitalArea || false;

    // 2. 임원 데이터 병합 (이름 + 주민번호 앞자리 기준)
    const mergedExecutives = new Map();

    registryResults.forEach(reg => {
      reg.executives.forEach(exec => {
        const juminFront = exec.id.split('-')[0];
        const key = `${exec.name}_${juminFront}`;

        if (!mergedExecutives.has(key)) {
          mergedExecutives.set(key, {
            ...exec,
            history: [...exec.history] // 복사
          });
        } else {
          const existing = mergedExecutives.get(key);
          // History 병합
          existing.history.push(...exec.history);
          
          // 주민번호 업데이트 (뒷자리가 *인 경우와 숫자인 경우가 섞여있을 수 있음. 숫자가 있는 쪽을 선호)
          if (existing.id.includes('*') && !exec.id.includes('*')) {
            existing.id = exec.id;
          }
          // 직위는 최신 정보가 반영되도록 덮어쓰기 (파일 순서에 따라 다를 수 있음)
          existing.position = exec.position;
        }
      });
    });

    // 3. 병합된 임원 데이터 후처리 (History 정렬, 중복 제거, Start/End 재계산)
    const finalExecutives = Array.from(mergedExecutives.values()).map(exec => {
        // History 중복 제거 (날짜+타입 기준)
        const uniqueHistory = [];
        const seenEvents = new Set();
        
        // 날짜순 정렬 먼저 수행
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
            if (['사임', '퇴임', '만료', '해임'].includes(lastEvent.type)) {
                endDate = lastEvent.date;
            }
        }
        
        return { ...exec, history: uniqueHistory, startDate, endDate };
    });

    // 4. 엑셀 출력
    let currentRow = 1;

    // 상호 및 소재지 (1회 출력)
    wsRegistry.mergeCells(`A${currentRow}:B${currentRow}`);
    wsRegistry.getCell(`A${currentRow}`).value = '상 호';
    wsRegistry.getCell(`A${currentRow}`).style = headerStyle;
    wsRegistry.mergeCells(`C${currentRow}:D${currentRow}`);
    wsRegistry.getCell(`C${currentRow}`).value = companyName;

    currentRow++;
    wsRegistry.mergeCells(`A${currentRow}:B${currentRow}`);
    wsRegistry.getCell(`A${currentRow}`).value = '소재지 구분';
    wsRegistry.getCell(`A${currentRow}`).style = headerStyle;
    wsRegistry.mergeCells(`C${currentRow}:D${currentRow}`);
    wsRegistry.getCell(`C${currentRow}`).value = isCapitalArea ? '수도권' : '비수도권';
    
    currentRow++;
    wsRegistry.mergeCells(`A${currentRow}:B${currentRow}`);
    wsRegistry.getCell(`A${currentRow}`).value = '본 점';
    wsRegistry.getCell(`A${currentRow}`).style = headerStyle;
    wsRegistry.mergeCells(`C${currentRow}:F${currentRow}`);
    wsRegistry.getCell(`C${currentRow}`).value = address;

    currentRow += 2; // 간격

    // 임원 테이블 헤더
    const tableHeaders = ['직위', '성명', '주민등록번호', '취임일', '사임/퇴임일', '재직기간'];
    const headerRow = wsRegistry.getRow(currentRow);
    headerRow.values = tableHeaders;
    headerRow.eachCell(cell => cell.style = headerStyle);
    currentRow++;

    // 임원 데이터 필터링 및 출력
    finalExecutives.forEach(exec => {
      // 필터링 로직
      if (allYears.size > 0) {
        const execStart = new Date(exec.startDate);
        const execEnd = exec.endDate ? new Date(exec.endDate) : new Date(); // 현재까지 재직 중 가정
        
        const targetStart = new Date(`${minYear}-01-01`);
        const targetEnd = new Date(`${maxYear}-12-31`);

        // 겹치지 않으면 스킵
        if (execEnd < targetStart || execStart > targetEnd) {
          return; 
        }
      }

      const row = wsRegistry.getRow(currentRow);
      row.values = [
        exec.position,
        exec.name,
        exec.id,
        exec.startDate,
        exec.endDate || '재직 중',
        `${exec.startDate} ~ ${exec.endDate || '현재'}`
      ];
      row.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      currentRow++;
    });

    // 컬럼 너비 설정
    wsRegistry.columns = [
      { width: 15 }, // 직위
      { width: 15 }, // 성명
      { width: 20 }, // 주민번호
      { width: 15 }, // 취임일
      { width: 15 }, // 사임일
      { width: 30 }, // 기간
    ];
  }

  // --- 시트 생성: 연도별 데이터 (기존 로직) ---
  for (const year of Object.keys(dataByYear).sort()) {
    const employees = dataByYear[year];
    console.log(`  -> 연도 ${year}: 총 ${employees.length}명 처리 중`);
    
    // 근무자 / 미근무자 분류
    const working = [];
    const nonWorking = [];
    
    employees.forEach(emp => {
      let isWorking = true;
      const targetYear = parseInt(year);
      
      if (!isNaN(targetYear)) {
        if (emp.입사일) {
          const hireYear = parseInt(emp.입사일.split('-')[0]);
          if (hireYear > targetYear) {
            isWorking = false;
            // console.log(`    -> 미근무(입사일): ${emp.성명} (${emp.입사일})`);
          }
        }
        if (emp.퇴사일) {
          const retireYear = parseInt(emp.퇴사일.split('-')[0]);
          if (retireYear < targetYear) {
            isWorking = false;
            // console.log(`    -> 미근무(퇴사일): ${emp.성명} (${emp.퇴사일})`);
          }
        }
      }
      
      if (isWorking) working.push(emp);
      else nonWorking.push(emp);
    });

    console.log(`    -> 근무자: ${working.length}명, 미근무자: ${nonWorking.length}명`);

    // 시트 생성 함수
    const addSheet = (sheetName, emps) => {
      // 시트 이름 길이 제한 (31자) 및 특수문자 처리
      const safeSheetName = sheetName.replace(/[\\/?*[\]]/g, '_').substring(0, 31);
      const worksheet = workbook.addWorksheet(safeSheetName);
      
      // 헤더
      const headers = ['성명', '주민등록번호', '입사일', '퇴사일', '급여계', '상여계', '총급여액'];
      for (let i = 1; i <= 12; i++) headers.push(`${i}월 급여`);
      for (let i = 1; i <= 12; i++) headers.push(`${i}월 상여`);
      
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.font = { bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });

      // 데이터
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
        
        // 스타일링
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          if (colNumber <= 4) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
          }
        });
      });

      // 열 너비
      worksheet.columns.forEach((col, index) => {
        if (index === 0) col.width = 12; // 성명
        else if (index === 1) col.width = 18; // 주민번호
        else if (index === 2 || index === 3) col.width = 12; // 날짜
        else col.width = 12; // 금액
      });
    };

    // 항상 두 시트 모두 생성 (데이터가 없어도)
    addSheet(year, working);
    addSheet(`${year}(미근무)`, nonWorking);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  console.log('[generateExcel] 엑셀 생성 완료');
  return buffer;
}
