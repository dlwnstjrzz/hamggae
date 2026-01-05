import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import ExcelJS from 'exceljs';

// Worker 설정 (CDN 사용 - unpkg가 npm 버전과 일치할 확률이 높음)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

// 날짜 정규화 (YYYY-MM-DD)
function normalizeDate(dateStr) {
  if (!dateStr || dateStr === '-' || dateStr.trim() === '') return null;

  const patterns = [
    /(\d{4})[./\-년]\s*(\d{1,2})[./\-월]\s*(\d{1,2})/, // 2023.01.01 or 2023년 01월 01일
    /(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})/,          // 2023-01-01
  ];

  for (const regex of patterns) {
    const match = dateStr.match(regex);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return null;
}

// PDF 페이지에서 단어 추출 (pdfplumber 스타일로 변환 - 글자 병합 로직 추가)
async function extractWordsFromPage(page, pageNum) {
  console.log(`[Page ${pageNum}] 텍스트 추출 시작`);
  const textContent = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1.0 });
  
  // 1. 원본 아이템 추출 및 좌표 변환
  let items = textContent.items.map(item => {
    // pdf.js transform: [scaleX, skewY, skewX, scaleY, x, y]
    const tx = item.transform;
    const x = tx[4];
    const y_bottom = tx[5]; // PDF는 좌하단이 원점
    const height = item.height || 10;
    const width = item.width;
    
    // Top-Left 기준 좌표계로 변환 (pdfplumber와 맞춤)
    const top = viewport.height - y_bottom - height;

    return {
      text: item.str,
      x0: x,
      x1: x + width,
      top: top,
      bottom: top + height,
      height: height,
      width: width,
      hasSpace: item.hasEOL // 줄바꿈 여부 등 (pdf.js 버전에 따라 다를 수 있음)
    };
  });

  // 빈 문자열 제거
  items = items.filter(item => item.text.trim().length > 0);

  // 2. Y좌표(Top) 기준으로 정렬 (같은 줄 끼리 모으기 위해)
  // 오차 범위(tolerance) 내에 있으면 같은 줄로 간주
  items.sort((a, b) => {
    if (Math.abs(a.top - b.top) < 5) return a.x0 - b.x0; // 같은 줄이면 X순 정렬
    return a.top - b.top; // 다른 줄이면 Y순 정렬
  });

  // 3. 글자 병합 (단어 만들기)
  const words = [];
  if (items.length === 0) return { words, viewport };

  let currentWord = items[0];

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    
    // 같은 줄인지 확인 (Y좌표 차이가 적음)
    const isSameLine = Math.abs(item.top - currentWord.top) < 5;
    
    // 바로 옆에 붙어있는지 확인 (X좌표 차이가 적음)
    // 글자 사이 간격이 좁으면 같은 단어로 취급
    const distance = item.x0 - currentWord.x1;
    const isAdjacent = distance < 5; // 5px 이내면 합침 (조절 가능)

    if (isSameLine && isAdjacent) {
      // 병합
      currentWord.text += item.text;
      currentWord.x1 = item.x1; // 끝 좌표 업데이트
      currentWord.width += item.width + distance;
      // 높이나 top은 기존 유지 (또는 평균)
    } else {
      // 기존 단어 저장 후 새로운 단어 시작
      words.push(currentWord);
      currentWord = item;
    }
  }
  words.push(currentWord); // 마지막 단어 저장

  console.log(`[Page ${pageNum}] 추출된 단어 수: ${words.length}`);
  // 디버깅용: 처음 10개 단어 출력
  // console.log(`[Page ${pageNum}] First 10 words:`, words.slice(0, 10).map(w => w.text));

  return { words, viewport };
}

function isFirstPage(words) {
  const fullText = words.map(w => w.text).join('');
  const textNoSpace = fullText.replace(/\s/g, '');
  
  const hasHireDate = textNoSpace.includes('입사일') || textNoSpace.includes('퇴사일');
  const hasTitle = textNoSpace.includes('근로소득지급명세');
  
  console.log(`[isFirstPage] 입사일/퇴사일: ${hasHireDate}, 제목: ${hasTitle}`);
  
  return hasHireDate || hasTitle;
}

function extractMonthRows(words) {
  console.log('[extractMonthRows] 월별 행 찾기 시작');
  const monthPositions = {};
  const monthCandidates = [];

  for (const word of words) {
    const text = word.text.trim();
    const x = word.x0;
    const y = word.top;

    if (x >= 100) continue; // 월은 좌측에만 있음

    let monthNum = null;
    
    // 정규식 매칭
    const matchWol = text.match(/^(\d{1,2})월$/);
    if (matchWol) {
      monthNum = parseInt(matchWol[1]);
    } else if (/^0[1-9]$|^1[0-2]$/.test(text)) {
      monthNum = parseInt(text);
    } else if (/^\d{1,2}$/.test(text)) {
      const num = parseInt(text);
      if (num >= 1 && num <= 12) monthNum = num;
    }

    if (monthNum !== null) {
      monthCandidates.push({ month: monthNum, y, text });
    }
  }

  // Y좌표로 정렬
  monthCandidates.sort((a, b) => a.y - b.y);

  // 중복 제거
  const seen = new Set();
  for (const cand of monthCandidates) {
    if (!seen.has(cand.month)) {
      monthPositions[cand.month] = cand.y;
      seen.add(cand.month);
    }
  }

  return monthPositions;
}

function extractSalaryBonusColumns(words) {
  console.log('[extractSalaryBonusColumns] 급여/상여 열 찾기 시작');
  let salaryX = null;
  let bonusX = null;

  const salaryWords = words.filter(w => {
    const text = w.text.replace(/\s/g, ''); // 공백 제거 후 확인
    return text.includes('급여') && !text.includes('구간') && !text.includes('인정') && text.length <= 6;
  });
  const bonusWords = words.filter(w => {
    const text = w.text.replace(/\s/g, ''); // 공백 제거 후 확인
    return text.includes('상여') && !text.includes('인정') && !text.includes('구간') && text.length <= 6;
  });

  console.log(`  -> '급여' 포함 단어 수: ${salaryWords.length}, '상여' 포함 단어 수: ${bonusWords.length}`);
  if (salaryWords.length > 0) console.log('  -> 급여 후보 단어들:', salaryWords.map(w => `"${w.text}"(x:${w.x0.toFixed(1)})`).join(', '));
  if (bonusWords.length > 0) console.log('  -> 상여 후보 단어들:', bonusWords.map(w => `"${w.text}"(x:${w.x0.toFixed(1)})`).join(', '));

  // 16, 17 찾기
  const col16Candidates = [];
  const col17Candidates = [];

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const text = w.text.trim();
    
    // 16 찾기 (단일 '16' 또는 분리된 '1', '6')
    let is16 = text === '16' || text === '⑯' || text === '(16)';
    if (!is16 && text === '1' && i + 1 < words.length) {
      const nextW = words[i + 1];
      if (nextW.text.trim() === '6' && Math.abs(nextW.x0 - w.x0) < 15) { // 15px 이내
        is16 = true;
        // console.log(`  -> 분리된 16 발견: x=${w.x0}`);
      }
    }

    if (is16) {
      // 근처에 급여 텍스트 있는지
      const hasSalaryNear = salaryWords.some(sw => Math.abs(sw.top - w.top) < 10 && (sw.x0 - w.x0) > 0 && (sw.x0 - w.x0) < 100);
      col16Candidates.push({ x: w.x0, priority: hasSalaryNear ? 1 : 2 });
    }

    // 17 찾기 (단일 '17' 또는 분리된 '1', '7')
    let is17 = text === '17' || text === '⑰' || text === '(17)';
    if (!is17 && text === '1' && i + 1 < words.length) {
      const nextW = words[i + 1];
      if (nextW.text.trim() === '7' && Math.abs(nextW.x0 - w.x0) < 15) { // 15px 이내
        is17 = true;
        // console.log(`  -> 분리된 17 발견: x=${w.x0}`);
      }
    }

    if (is17) {
      const hasBonusNear = bonusWords.some(bw => Math.abs(bw.top - w.top) < 10 && (bw.x0 - w.x0) > 0 && (bw.x0 - w.x0) < 100);
      col17Candidates.push({ x: w.x0, priority: hasBonusNear ? 1 : 2 });
    }
  }

  if (col16Candidates.length > 0) {
    col16Candidates.sort((a, b) => a.priority - b.priority);
    salaryX = col16Candidates[0].x;
    console.log(`  -> 급여(16) 열 X좌표 후보 선택: ${salaryX}`);
  } else {
    console.log('  -> [알림] 숫자 "16"을 찾지 못했습니다.');
  }

  if (col17Candidates.length > 0) {
    col17Candidates.sort((a, b) => a.priority - b.priority);
    bonusX = col17Candidates[0].x;
    console.log(`  -> 상여(17) 열 X좌표 후보 선택: ${bonusX}`);
  }

  // Fallback
  if (salaryX === null && salaryWords.length > 0) {
    salaryX = salaryWords[0].x0;
    console.log(`  -> 급여 텍스트 기준 X좌표 선택: ${salaryX}`);
  }
  if (bonusX === null && bonusWords.length > 0) {
    bonusX = bonusWords[0].x0;
    console.log(`  -> 상여 텍스트 기준 X좌표 선택: ${bonusX}`);
  }

  return { salaryX, bonusX };
}

function extractValueAtPosition(words, targetX, targetY, toleranceX = 40, toleranceY = 5) {
  for (const w of words) {
    if (Math.abs(w.x0 - targetX) < toleranceX && Math.abs(w.top - targetY) < toleranceY) {
      const cleanText = w.text.replace(/,/g, '').trim();
      if (/^\d+$/.test(cleanText)) {
        return parseInt(cleanText, 10);
      }
    }
  }
  return 0;
}

function extractEmployeeData(words, year) {
  console.log('[extractEmployeeData] 사원 정보 추출 시작');
  const data = {
    성명: '',
    주민등록번호: '',
    입사일: null,
    퇴사일: null,
    monthly_salary: {},
    monthly_bonus: {},
    총급여액: 0,
    총상여액: 0
  };
  for (let i = 1; i <= 12; i++) {
    data.monthly_salary[i] = 0;
    data.monthly_bonus[i] = 0;
  }

  const fullText = words.map(w => w.text).join(' '); // 공백 포함 연결
  console.log(`  -> 전체 텍스트 길이: ${fullText.length}`);

  // 성명
  const nameMatch = fullText.match(/⑤\s*성\s*명\s+([^\s⑥]+)/) || fullText.match(/성\s*명\s+([^\s⑥]+)/);
  if (nameMatch) {
    data.성명 = nameMatch[1].trim();
    console.log(`  -> 성명 추출: ${data.성명}`);
  } else {
    console.log('  -> 성명 추출 실패');
  }

  // 주민등록번호
  const juminMatch = fullText.match(/⑥\s*주민등록번호\s+(\d{6}-(?:\d{7}|\d\*{6}|\*{7}))/) || fullText.match(/주민등록번호\s+(\d{6}-(?:\d{7}|\d\*{6}|\*{7}))/);
  if (juminMatch) {
    data.주민등록번호 = juminMatch[1].trim();
    console.log(`  -> 주민등록번호 추출: ${data.주민등록번호}`);
  }

  // 입사일
  const hireMatch = fullText.match(/⑦\s*입사일\s+([^\s⑧]+)/) || fullText.match(/입사일\s+([^\s⑧퇴]+)/);
  if (hireMatch) {
    data.입사일 = normalizeDate(hireMatch[1].trim());
    console.log(`  -> 입사일 추출: ${data.입사일}`);
  }

  // 퇴사일
  const retireMatch = fullText.match(/퇴사일\s+([^\s⑨국]+)/) || fullText.match(/⑧\s*퇴사일\s+([^\s⑨]+)/);
  if (retireMatch) {
    const rDate = normalizeDate(retireMatch[1].trim());
    if (rDate) {
      // 연도 말 기준 재직 여부 체크
      if (year) {
        const rDateObj = new Date(rDate);
        const yearEnd = new Date(`${year}-12-31`);
        if (rDateObj <= yearEnd) {
          data.퇴사일 = rDate;
        } else {
          console.log(`  -> 퇴사일(${rDate})이 연말(${year}-12-31) 이후이므로 무시`);
        }
      } else {
        data.퇴사일 = rDate;
      }
    }
    console.log(`  -> 퇴사일 최종: ${data.퇴사일}`);
  }

  // 월별 데이터
  const monthPositions = extractMonthRows(words);
  const { salaryX, bonusX } = extractSalaryBonusColumns(words);

  if (salaryX || bonusX) {
    for (let m = 1; m <= 12; m++) {
      if (monthPositions[m]) {
        const y = monthPositions[m];
        if (salaryX) {
          const val = extractValueAtPosition(words, salaryX, y);
          data.monthly_salary[m] = val;
          if (val > 0) console.log(`    -> ${m}월 급여: ${val}`);
        }
        if (bonusX) {
          const val = extractValueAtPosition(words, bonusX, y);
          data.monthly_bonus[m] = val;
          if (val > 0) console.log(`    -> ${m}월 상여: ${val}`);
        }
      }
    }
  } else {
    console.log('  -> [경고] 급여/상여 열 좌표를 찾지 못했습니다.');
  }

  // 합계 계산
  data.총급여액 = Object.values(data.monthly_salary).reduce((a, b) => a + b, 0);
  data.총상여액 = Object.values(data.monthly_bonus).reduce((a, b) => a + b, 0);
  console.log(`  -> 총급여: ${data.총급여액}, 총상여: ${data.총상여액}`);

  return data;
}

export async function processPDF(file) {
  console.log(`\n=== 파일 처리 시작: ${file.name} ===`);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const employees = [];
  
  // 파일명에서 연도 추출
  const yearMatch = file.name.match(/_(\d{4})\.pdf$/);
  const year = yearMatch ? yearMatch[1] : null;
  console.log(`-> 추출된 연도: ${year}`);

  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const { words } = await extractWordsFromPage(page, i + 1);

    if (isFirstPage(words)) {
      console.log(`[Page ${i + 1}] 사원 첫 페이지 감지됨`);
      const empData = extractEmployeeData(words, year);
      if (empData.성명) {
        employees.push(empData);
        console.log(`-> 사원 추가됨: ${empData.성명}`);
      } else {
        console.log(`-> [경고] 성명을 찾지 못해 사원 추가 실패`);
      }
    } else {
      // console.log(`[Page ${i + 1}] 사원 첫 페이지 아님`);
    }
  }

  console.log(`=== 파일 처리 완료: ${employees.length}명 추출 ===\n`);
  return { employees, year, filename: file.name };
}

export async function generateExcel(results) {
  console.log('[generateExcel] 엑셀 생성 시작');
  const workbook = new ExcelJS.Workbook();
  
  // 결과 그룹화 (연도별)
  const dataByYear = {};
  
  results.forEach(res => {
    // 연도 추출 실패 시 파일명에서 다시 시도하거나 로그 출력
    let year = res.year;
    if (!year) {
      const match = res.filename.match(/(\d{4})/);
      if (match) year = match[1];
      else year = 'Unknown';
      console.log(`  -> [경고] 연도 추출 실패하여 대체값 사용: ${res.filename} -> ${year}`);
    }
    
    if (!dataByYear[year]) dataByYear[year] = [];
    dataByYear[year].push(...res.employees);
  });

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
