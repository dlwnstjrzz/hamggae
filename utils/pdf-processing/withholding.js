import { normalizeDate, extractWordsFromPage } from './common';

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

export async function processWithholdingPDF(pdf, filename, preLoadedWords) {
  const employees = [];
  
  // 파일명에서 연도 추출
  const yearMatch = filename.match(/_(\d{4})\.pdf$/) || filename.match(/(\d{4})/);
  const year = yearMatch ? yearMatch[1] : null;
  console.log(`-> 추출된 연도: ${year}`);

  for (let i = 0; i < pdf.numPages; i++) {
    let words;
    // 첫 페이지는 이미 읽었으면 재사용 (최적화)
    if (i === 0 && preLoadedWords) {
      words = preLoadedWords;
    } else {
      const page = await pdf.getPage(i + 1);
      const res = await extractWordsFromPage(page, i + 1, 5);
      words = res.words;
    }

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
  return { type: 'withholding', employees, year, filename };
}
