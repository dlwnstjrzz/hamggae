import { extractWordsFromPage } from './common';


// Y좌표 기준으로 줄 단위 그룹핑
function groupWordsByLine(words) {
  const lines = [];
  const sortedWords = [...words].sort((a, b) => a.top - b.top);
  
  if (sortedWords.length === 0) return [];

  let currentLine = [sortedWords[0]];
  
  for (let i = 1; i < sortedWords.length; i++) {
    const w = sortedWords[i];
    const prev = currentLine[currentLine.length - 1];
    
    if (Math.abs(w.top - prev.top) < 10) { // 같은 줄로 간주
       currentLine.push(w);
    } else {
       lines.push(currentLine);
       currentLine = [w];
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  
  return lines;
}

// 키워드와 지시자(번호)를 이용해 값 추출
function findValueByKeywords(words, keyword, indicator) {
  const lines = groupWordsByLine(words);
  
  for (const line of lines) {
    // X좌표 정렬
    line.sort((a, b) => a.x0 - b.x0);
    const lineText = line.map(w => w.text).join('');
    
    // 1. 키워드 포함 여부 확인 (공백 제거 후 비교)
    if (!lineText.replace(/\s/g, '').includes(keyword.replace(/\s/g, ''))) {
      continue;
    }

    // 2. 지시자(번호) 찾기
    // 지시자는 단어 안에 포함되어 있을 수도 있음 (예: "과세표준(112+159)56")
    // 단, 금액(콤마 포함)이 아니어야 함.
    let indicatorIndex = -1;
    
    for (let i = 0; i < line.length; i++) {
      const text = line[i].text;
      
      // 지시자가 포함되어 있고, 콤마가 없으면(금액이 아니면) 지시자로 간주
      // "56"이 포함된 토큰을 찾음
      if (text.includes(indicator) && !text.includes(',')) {
        indicatorIndex = i;
        // 키워드("과세표준")보다 오른쪽에 있는 것이 확실한지 체크할 수도 있지만,
        // 보통 번호는 키워드 뒤에 나오므로 일단 발견하면 채택
        // 만약 "156" 처럼 우연히 포함된 경우를 배제하려면 더 엄격한 조건 필요할 수 있음
        // 하지만 사용자 요청에 따라 "56이 포함된" 것으로 판단.
      }
    }

    if (indicatorIndex !== -1) {
      // 3. 지시자 오른쪽에서 숫자 찾기
      for (let j = indicatorIndex + 1; j < line.length; j++) {
        const rawText = line[j].text.trim();
        const valText = rawText.replace(/,/g, '');
        
        // 숫자로만 구성되어 있는지 확인 (음수 포함 가능성 고려 시 -? 추가)
        if (/^-?\d+$/.test(valText)) {
          console.log(`-> 값 발견 [${keyword}/${indicator}]: ${rawText} (Line: ${lineText})`);
          return parseInt(valText, 10);
        }
      }
    }
  }
  return 0;
}

// FullText 기반 값 추출 공통 함수
// targetIndex: 키워드 뒤에 나오는 숫자들 중 몇 번째 숫자를 가져올지 (0-based)
// requiredIndicator: 값 앞에 반드시 존재해야 하는 지시자 (예: "21"). 해당 지시자가 없거나 다르면 무시
function findValueFromFullText(words, keyword, debugName = keyword, targetIndex = 0, requiredIndicator = null) {
  // 단어들을 공백으로 연결하여 전체 텍스트 생성
  const fullText = words.map(w => w.text).join(' ');

  console.log(`[DEBUG] findValueFromFullText [${debugName}] fullText:`, fullText);
  
  // 키워드 찾기 (글자 사이 공백 허용, 전역 검색)
  // 예: "과세표준" -> "과\s*세\s*표\s*준" (과 세 표 준, 과세표준 등 모두 매칭)
  const keywordPattern = keyword.split('').join('\\s*');
  const keywordRegex = new RegExp(keywordPattern, 'g');
  
  let match;
  
  while ((match = keywordRegex.exec(fullText)) !== null) {
    
    // 키워드 이후의 텍스트만 추출
    let textAfter = fullText.substring(match.index + match[0].length);
    
    // targetIndex 만큼 숫자 매칭 반복
    let foundValue = 0;
    let success = true;

    for (let i = 0; i <= targetIndex; i++) {
        let valStr = null;
        let foundInd = null;
        let sign = null; // 부호 (△, -)
        let matchLen = 0;

        // 정규식 공통: 숫자 앞의 부호([△\-−]?) 허용. (마이너스 기호 다양성 고려)
        // 1. 괄호가 있는 경우 (예: "가감계 (- +) 21 1,000")
        // (\d{1,3}(?![\d,]))? : 괄호 뒤 Optional 지시자
        let m = textAfter.match(/^\s*[\(\[][^\)\]]*[\)\]]\s*(\d{1,3}(?![\d,]))?\s*[:]?\s*([△\-−]?)\s*([\d,]+)/);
        if (m) {
            foundInd = m[1]; // 지시자 (있을 수도 없을 수도)
            sign = m[2];     // 부호
            valStr = m[3];   // 값
            matchLen = m[0].length;
        }

        // 2. 지시자 + 공백 + 값 (예: "가감계 21 1,000")
        if (!m) {
            m = textAfter.match(/^\s*(\d{1,3})\s+([△\-−]?)\s*([\d,]+)/);
            if (m) {
                foundInd = m[1];
                sign = m[2];
                valStr = m[3];
                matchLen = m[0].length;
            }
        }

        // 3. 지시자 없이 바로 숫자 (예: "과세표준 1,000", "과 세 표 준 △72,142,319")
        if (!m) {
            m = textAfter.match(/^\s*([△\-−]?)\s*([\d,]+)/);
            if (m) {
                foundInd = null;
                sign = m[1];
                valStr = m[2];
                matchLen = m[0].length;
            }
        }
    
        if (m) {
            // 필수 지시자 검증
            if (requiredIndicator) {
                if (foundInd !== requiredIndicator) {
                    success = false;
                    break; 
                }
            }

            if (i === targetIndex) {
                let val = parseInt(valStr.replace(/,/g, ''), 10);
                // 부호 처리 (△, -, − 이면 음수)
                if (sign && (sign === '△' || sign === '-' || sign === '−')) {
                    val = -val;
                }

                if (!isNaN(val)) {
                    foundValue = val;
                    // 디버그 로그 추가
                    console.log(`   -> Found Value for ${debugName}: ${val} (Raw: ${sign || ''}${valStr})`);
                } else {
                    success = false;
                }
            }
            // 다음 숫자를 찾기 위해 현재 매칭된 부분을 건너뜀
            textAfter = textAfter.substring(m.index + matchLen);
        } else {
            success = false;
            break;
        }
    }

    if (success && foundValue !== 0) {
        return foundValue;
    }
    
  }
  
  console.log(`[DEBUG] ${debugName} keyword search finished. No valid value found.`);
  return 0; // 못 찾으면 0 반환
};

export async function processTaxReturnPDF(pdf, filename) {
  const result = {
    type: 'taxReturn',
    filename,
    year: null,
    data: {
      taxBase: 0,       // 과세표준 (56)
      calculatedTax: 0, // 산출세액 (12)
      minTaxTarget: 0,  // 최저한세 적용대상 감면세액 (17)
      deductedTax: 0,   // 차감세액 (18)
      totalAdjustment: 0, // 가감계 (21)
      minTax: 0,        // 최저한세 (20번 산출세액 옆 최저한세)
      minTaxAdjustment: 0, // 최저한세 적용대상 공제 여분 (계산값)
      taxCredits: []    // 세액공제 항목 리스트
    }
  };

  // 파일명에서 연도 추출
  const yearMatch = filename.match(/_(\d{4})\.pdf$/) || filename.match(/(\d{4})/);
  result.year = yearMatch ? yearMatch[1] : 'Unknown';
  console.log(`-> [법인세신고서] 추출된 연도: ${result.year}`);

  let taxCreditStartPageIdx = -1; // 세액공제조정명세서 시작 페이지 인덱스


  // 페이지 순회
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const { words } = await extractWordsFromPage(page, i + 1);
    const fullText = words.map(w => w.text).join('');
    const textNoSpace = fullText.replace(/\s/g, '');

    // 1. 법인세과세표준및세액신고서 (과세표준, 산출세액 추출)
    if (textNoSpace.includes('법인세과세표준및세액신고서')) {
      console.log(`[Page ${i + 1}] 법인세과세표준및세액신고서 발견`);
      
      // 연도 추출 보완 (문서 내용 우선)
      // 예: "⑪사 업 연 도2024.01.01~ 2024.12.31"
      // 공백 제거된 텍스트에서 패턴 찾기: 사업연도(\d{4})
      const yearMatchContent = textNoSpace.match(/사업연도(\d{4})/);
      if (yearMatchContent) {
          result.year = yearMatchContent[1];
          console.log(`-> [법인세신고서] 문서 내용에서 연도 추출: ${result.year}`);
      } else {
          // 공백 포함 텍스트에서 찾기 (Backup)
          const yearMatchRaw = fullText.match(/사\s*업\s*연\s*도\s*(\d{4})/);
          if (yearMatchRaw) {
              result.year = yearMatchRaw[1];
              console.log(`-> [법인세신고서] 문서 내용(Raw)에서 연도 추출: ${result.year}`);
          }
      }

      result.data.taxBase = findValueFromFullText(words, '과세표준', '과세표준');
      // 과세표준과 동일한 로직으로 산출세액 추출
      result.data.calculatedTax = findValueFromFullText(words, '산출세액', '산출세액');
    }

    // 2. 법인세과세표준및세액조정계산서 (나머지 항목 추출)
    // 줄바꿈 등으로 "법인세과세표준및..." 전체가 안 붙어있을 수 있으므로 "세액조정계산서"만 포함돼도 인정
    if (textNoSpace.includes('세액조정계산서')) {
      console.log(`[Page ${i + 1}] 법인세과세표준및세액조정계산서(세액조정계산서 키워드) 발견`);
      
      // 1. 산출세액 (12) -> 기존 로직 유지하되, 위에서 찾았으면 덮어쓰지 않거나 여기서 찾은걸 우선할지 결정
      // 사용자가 "이 페이지에서 가져올거야"라고 했으므로 위에서 찾은 값이 0이 아니면 여기서 다시 찾을 필요 없거나
      // 혹은 신고서의 값이 더 정확하다면 신고서 값을 우선.
      // 일단 신고서에서 찾았으면(0이 아니면) 여기서 덮어쓰지 않도록 함.
      if (result.data.calculatedTax === 0) {
          result.data.calculatedTax = findValueByKeywords(words, '산출세액', '12');
      }
      
      // 2. 최저한세 적용대상 (17) - 감면세액
      // FullText 기반 탐색으로 변경 (로그 확인용)
      // 여러 패턴 시도: 17이 붙어있는 경우, full name인 경우, 짧은 이름인 경우
      
      // [0순위] 유연한 17번 탐색 (사용자 요청: 키워드 뒤 20자 이내에 17이 있으면 추출)
      // "최저한세적용대상" ... (어쩌구) ... "17" ... (값)
      if (result.data.minTaxTarget === 0) {
          // 키워드 "최저한세적용대상"의 각 글자 사이에 \s* 허용
          const baseKeyword = '최저한세적용대상';
          const keywordPattern = baseKeyword.split('').join('\\s*');
          
          // 키워드 + (0~20자 아무거나) + (17 또는 (17)) + 공백 + (부호+숫자)
          const smartRegex = new RegExp(`${keywordPattern}[\\s\\S]{0,20}?(?:17|\\(17\\))\\s*([△\\-−]?[\\d,]+)`);
          const m = fullText.match(smartRegex);
          
          if (m) {
              const valStr = m[1];
              // 부호 처리
              let sign = 1;
              if (valStr.startsWith('△') || valStr.startsWith('-') || valStr.startsWith('−')) {
                 sign = -1;
              }
              const val = parseInt(valStr.replace(/[△\-−,]/g, ''), 10);
              
              if (!isNaN(val)) {
                  result.data.minTaxTarget = val * sign;
                  console.log(`-> [SmartMatch] 최저한세적용대상 + 17 (유연한 검색) 성공: ${result.data.minTaxTarget}`);
              }
          }
      }

      if (result.data.minTaxTarget === 0) {
        // 1순위: "최저한세적용대상공제감면세액17" (사용자 제보 패턴: 17이 텍스트처럼 붙어있는 경우)
        result.data.minTaxTarget = findValueFromFullText(words, '최저한세적용대상공제감면세액17', '최저한세적용대상(17포함)');
        
        // 2순위: "최저한세적용대상공제감면세액" (17이 (17) 형태 등으로 뒤에 분리되어 있는 경우)
        if (result.data.minTaxTarget === 0) {
           result.data.minTaxTarget = findValueFromFullText(words, '최저한세적용대상공제감면세액', '최저한세적용대상(풀네임)');
        }
        
        // 3순위: "최저한세적용대상17" (짧은 이름 뒤에 17이 붙은 경우) - 사용자 요청
        if (result.data.minTaxTarget === 0) {
           result.data.minTaxTarget = findValueFromFullText(words, '최저한세적용대상17', '최저한세적용대상(짧은+17포함)');
        }

        // 4순위: "최저한세적용대상" (가장 짧은 형태, 뒤에 다른 문자가 오면 실패할 수 있음)
        if (result.data.minTaxTarget === 0) {
           result.data.minTaxTarget = findValueFromFullText(words, '최저한세적용대상', '최저한세적용대상(짧은)');
        }
      }

      // 3. 차감세액 (18)
      // 사용자 요청: 18이 붙어있는 숫자 추출 (예: "차감세액 18 1,000,000")
      // 1순위: "차감세액18" 패턴으로 18까지 키워드로 인식하여 소비
      result.data.deductedTax = findValueFromFullText(words, '차감세액18', '차감세액(18포함)');
      
      // 2순위: (18) 로 되어있어서 위 패턴에 안걸린 경우 (예: "차감세액 (18) 1,000,000")
      // "차감세액" 키워드 사용 시 내부 로직이 (18) 괄호 지시자를 건너뛰고 값 추출
      if (result.data.deductedTax === 0) {
        result.data.deductedTax = findValueFromFullText(words, '차감세액', '차감세액(괄호지시자처리)');
      }

      // 4. 가감계 (21)
      // FullText 기반 탐색 (로그 확인용)
      // 사용자 요청: 반드시 "21"이 주변에 있어야 함 (필수 지시자 검증)
      if (result.data.totalAdjustment === 0) {
        result.data.totalAdjustment = findValueFromFullText(words, '가감계', '가감계', 0, '21');
      }

      console.log(`[DEBUG_PAGE_ADJUST] 법인세과세표준및세액조정계산서 추출 결과:`);
      console.log(`   - 산출세액(calculatedTax): ${result.data.calculatedTax}`);
      console.log(`   - 최저한세 적용대상(minTaxTarget): ${result.data.minTaxTarget}`);
      console.log(`   - 차감세액(deductedTax): ${result.data.deductedTax}`);
      console.log(`   - 가감계(totalAdjustment): ${result.data.totalAdjustment}`);
    }



    // 2. 최저한세조정계산서
    if (textNoSpace.includes('최저한세조정계산서')) {
      console.log(`[Page ${i + 1}] 최저한세조정계산서 발견`);
      
      // 최저한세 (20)
      // 사용자 요청: FullText 기반, "산출세액" 옆에 "20"이 있는 경우 (산출세액20 또는 산출세액(20) 등)
      // 그리고 그 뒤에 **2번째 숫자**를 추출해야 함
      
      // 1순위: "산출세액20" (20이 바로 붙어있는 경우) - targetIndex: 1
      result.data.minTax = findValueFromFullText(words, '산출세액20', '최저한세_산출세액(20포함,2nd)', 1);
      
      // 2순위: "산출세액" (fallback) - 20이 분리되어 있거나 괄호. 이 경우 2번째 숫자가 맞는지 확인 필요하지만
      // 일단 index 1으로 시도.
      if (result.data.minTax === 0) {
        result.data.minTax = findValueFromFullText(words, '산출세액', '최저한세_산출세액(Fallback,2nd)', 1);
      }
    }

    // 3. 세액공제조정명세서 (Gemini AI 적용)
    if (textNoSpace.includes('세액공제조정명세서')) {
       if (taxCreditStartPageIdx === -1) taxCreditStartPageIdx = i;
    }

    const isMinTaxPage = textNoSpace.includes('최저한세조정계산서');
    const isReportPage = textNoSpace.includes('법인세과세표준및세액신고서');
    const isInCreditRange = (taxCreditStartPageIdx !== -1 && i <= taxCreditStartPageIdx + 2);
    
    // 세액공제조정명세서 관련 페이지라면 (PDF.js Raw Text + 정규식 + 코드매핑)
    if ((textNoSpace.includes('세액공제조정명세서') || isInCreditRange) && !isMinTaxPage && !isReportPage) {
       console.log(`[Page ${i + 1}] 세액공제조정명세서 감지 - 정규식(Regex) 기반 추출 시도`);
       
       // 1. 공백 제거 및 전처리
       const rawContent = await page.getTextContent();
       const rawText = rawContent.items.map(item => item.str).join('');
       
       console.log(`--- [DEBUG] Raw Text for Page ${i+1} Start ---`);
       console.log(rawText);
       console.log(`--- [DEBUG] Raw Text for Page ${i+1} End ---`);

       let cleanText = rawText.replace(/\s/g, ''); 

       // 2. '1A1' 코드가 나오면 그 이후는 무시 (Footer/오류 방지)
       if (cleanText.includes('1A1')) {
           console.log(`[Page ${i+1}] '1A1' 코드 감지 - 이후 텍스트 절삭`);
           cleanText = cleanText.split('1A1')[0];
       }

       // 3. 주요 세액공제 코드 매핑표
       const TAX_CREDIT_CODES = {
         '131': '중소기업 등 투자세액공제',
         '14Z': '상생결제 지급금액에 대한 세액공제',
         '14M': '대중소기업상생협력을위한기금출연세액공제',
         '18D': '협력중소기업에 대한 유형고정자산 무상임대 세액공제',
         '18L': '수탁기업에 설치하는 시설에 대한 세액공제',
         '18R': '교육기관에 무상 기증하는 중고자산에 대한 세액공제',
         '16A': '신성장ㆍ원천기술 연구개발비세액공제(최저한세 적용제외)',
         '10D': '국가전략기술 연구개발비세액공제(최저한세 적용제외)',
         '16B': '일반 연구ㆍ인력개발비세액공제(최저한세 적용제외)',
         '13L': '신성장ㆍ원천기술 연구개발비세액공제(최저한세 적용대상)',
         '10E': '국가전략기술 연구개발비세액공제(최저한세 적용대상)',
         '13M': '일반 연구ㆍ인력개발비세액공제(최저한세 적용대상)',
         '176': '기술취득에대한세액공제',
         '14T': '기술혁신형 합병에 대한 세액공제',
         '14U': '기술혁신형 주식취득에 대한 세액공제',
         '18E': '벤처기업등 출자에 대한 세액공제',
         '18H': '성과공유 중소기업 경영성과급 세액공제',
         '134': '연구ㆍ인력개발설비투자세액공제',
         '177': '에너지절약시설투자세액공제',
         '14A': '환경보전시설 투자세액공제',
         '142': '근로자복지증진시설투자세액공제',
         '136': '안전시설투자세액공제',
         '135': '생산성향상시설투자세액공제',
         '14B': '의약품품질관리시설투자세액공제',
         '18B': '신성장기술 사업화를 위한 시설투자 세액공제',
         '18C': '영상콘텐츠 제작비용에 대한 세액공제',
         '18I': '초연결 네트워크 시설투자에 대한 세액공제',
         '14N': '고용창출투자세액공제',
         '14S': '산업수요맞춤형고교등졸업자복직중소기업세액공제',
         '14X': '경력단절 여성 고용 기업 등에 대한 세액공제',
         '18J': '육아휴직 후 고용유지 기업에 대한 인건비 세액공제',
         '14Y': '근로소득을 증대시킨 기업에 대한 세액공제',
         '18A': '청년고용을 증대시킨 기업에 대한 세액공제',
         '18F': '고용을 증대시킨 기업에 대한 세액공제',
         '18S': '통합고용세액공제',
         '1B4': '통합고용세액공제(정규직 전환)',
         '1B5': '통합고용세액공제(육아휴직 복귀)',
         '14H': '정규직근로자전환세액공제',
         '18K': '고용유지중소기업에 대한 세액공제',
         '14Q': '중소기업고용증가인원에대한사회보험료세액공제',
         '18G': '중소기업 사회보험 신규가입에 대한 사회보험료 세액공제',
         '184': '전자신고에대한세액공제(납세의무자)',
         '14J': '전자신고에대한세액공제(세무법인등)',
         '14E': '제3자물류비용세액공제',
         '14I': '대학맞춤형교육비용등세액공제',
         '14K': '대학등기부설비에대한세액공제',
         '14O': '기업의운동경기부설치운영비용세액공제',
         '14R': '산업수요맞춤형고교등재학생현장훈련수당세액공제',
         '14P': '석유제품전자상거래에대한세액공제',
         '14V': '금 현물시장에서 거래되는 금지금에 대한 과세특례',
         '14W': '금사업자와 스크랩등사업자의 수입금액의 증가 등에 대한 세액공제',
         '10A': '성실신고 확인비용에 대한 세액공제',
         '18M': '우수 선화주 인증받은 국제물류주선업자에 대한 세액공제',
         '10C': '용역제공자에 관한 과세자료의 제출에 대한 세액공제',
         '18N': '소재·부품·장비 수요기업 공동출자 세액공제',
         '18P': '소재·부품·장비 외국법인 인수세액공제',
         '10B': '상가임대료를 인하한 임대사업자에 대한 세액공제',
         '18Q': '선결제 금액에 대한 세액공제',
         '13W': '통합투자세액공제(일반)',
         '1B1': '임시통합투자세액공제(일반)',
         '13X': '통합투자세액공제(신성장·원천기술)',
         '1B2': '임시통합투자세액공제(신성장·원천기술)',
         '13Y': '통합투자세액공제(국가전략기술)',
         '1B3': '임시통합투자세액공제(국가전략기술)'
       };

       // 4. 정규식 동적 생성 (Map에 있는 코드만 매칭)
       // 예: (131|14Z|14M...)([\d,]+)
       const codePattern = Object.keys(TAX_CREDIT_CODES).join('|');
       const regex = new RegExp(`(${codePattern})([\\d,]+)`, 'g');
       
       let match;
       while ((match = regex.exec(cleanText)) !== null) {
           const code = match[1];
           const amountStr = match[2];
           const name = TAX_CREDIT_CODES[code];
           
           // 숫자 파싱
           const amount = parseInt(amountStr.replace(/,/g, ''), 10);
           
           // 5. 금액 필터링 (최소 5자리(10000) 이상)
           if (amount >= 10000) {
               // 중복 방지
               const exists = result.data.taxCredits.some(c => c.code === code && c.amount === amount);
               if (!exists) {
                    result.data.taxCredits.push({
                       name: name,
                       code: code,
                       amount: amount
                    });
                    console.log(`   + [Regex] 추출 성공: ${name} (${code}) = ${amount}`);
               }
           } else {
               // console.log(`   - [Skip] 금액 미달/0: ${name} (${code}) = ${amount}`);
           }
       }
    }

    // 주식등변동상황명세서 감지
    if (textNoSpace.includes('주식등변동상황명세서')) {
        console.log(`[Page ${i + 1}] 주식등변동상황명세서 감지 - Raw Text 추출`);
        
        const rawContent = await page.getTextContent();
        const rawTextWithSpace = rawContent.items.map(item => item.str).join(' ');
        
        console.log(`--- [DEBUG] Share Page Raw Text Start ---`);
        console.log(rawTextWithSpace);
        console.log(`--- [DEBUG] Share Page Raw Text End ---`);

        // 관계 코드 매핑
        const RELATION_CODES = {
            '00': '본인(최대주주)',
            '01': '배우자',
            '02': '자',
            '03': '부모',
            '04': '형제·자매',
            '05': '손',
            '06': '조부모',
            '07': '02~06의 배우자',
            '08': '01~07 이외의 친족',
            // '09': '기타', // 제외
            // '10': '특수관계법인' // 제외
        };

        const shareholders = [];
        
        // 행 추출 정규식: (개인|법인)
        // 숫자 인덱스는 무시하고 "개인" 또는 "법인" 키워드 기준으로 청크 분리
        const rowRegex = /(개\s*인|법\s*인)/g;
        let match;
        
        // 매칭된 위치들을 찾아서 청크로 나눔
        const matches = [];
        while ((match = rowRegex.exec(rawTextWithSpace)) !== null) {
            matches.push({ index: null, type: match[1], start: match.index });
        }
        console.log(`[DEBUG] Shareholder Rows Found: ${matches.length}`);

        for (let k = 0; k < matches.length; k++) {
            const m = matches[k];
            const nextStart = (k < matches.length - 1) ? matches[k+1].start : rawTextWithSpace.length;
            let chunk = rawTextWithSpace.substring(m.start, nextStart);
            
            // 다음 행의 인덱스 번호(예: "4")가 청크 끝에 포함될 수 있으므로 제거
            // " ... 0 0  4   " -> " ... 0 0"
            chunk = chunk.replace(/\s+\d+\s*$/, '');
            
            // 1. 이름 추출 (개인/법인 뒤에 나오는 한글/영문)
            // 예: "3 개인 원 지 연 ..."
            // 공백을 포함하여 이름이 흩어져 있을 수 있음. 
            // Type(개인) 뒤 ~ 주민번호 앞 까지가 이름 영역
            
            console.log(`[DEBUG] Check Chunk(${k}): "${chunk}"`);

            // 주민번호 찾기 (공백 포함된 패턴)
            const idRegex = /(\d[\s\d]{5,10}-\s*[\d\s*]{7,14})/; // 숫자/공백 6자리 + - + 7자리
            const idMatch = chunk.match(idRegex);
            console.log(`[DEBUG] ID Match Result:`, idMatch ? idMatch[0] : 'None');
            
            if (idMatch) {
                const rawID = idMatch[1];
                const cleanID = rawID.replace(/\s/g, '');
                
                // 이름 영역: chunk 시작 ~ ID 시작 전
                // "3 개인 " 이후 ~ ID 전
                const typeIndex = chunk.indexOf(m.type);
                const idIndex = chunk.indexOf(rawID);
                
                if (typeIndex !== -1 && idIndex !== -1 && idIndex > typeIndex) {
                    const rawName = chunk.substring(typeIndex + m.type.length, idIndex).trim();
                    const cleanName = rawName.replace(/\s/g, '').replace(/\d+/g, ''); // 이름 공백 및 숫자 제거 (예: "고영우6" -> "고영우")
                    
                    // 값 영역: ID 끝 ~ Chunk 끝
                    // 대한민국 KR 등 문자열 제거 필요
                    let tail = chunk.substring(idIndex + rawID.length);
                    // 공백 제거 후 분석
                    const cleanTail = tail.replace(/\s/g, '').replace(/대한민국/g, '').replace(/KR/g, '');
                    console.log(`[DEBUG] Clean Tail: "${cleanTail}"`);
                    // cleanTail 예상: "1,600401,6004000" (기초...기말[주식][지분][코드])
                    // 뒤에 "일련번호..." 같은 쓰레기 값이 붙을 수 있으므로 정규식으로 앞부분 숫자+코드만 추출
                    const tailMatch = cleanTail.match(/^([\d,.]+)(\d{2})/);
                    
                    if (tailMatch) {
                        const numericPart = tailMatch[1];
                        const code = tailMatch[2];
                        console.log(`[DEBUG] Code: "${code}", Numeric Part: "${numericPart}"`);

                        if (RELATION_CODES[code]) {
                            // 숫자 파싱 (Comma 활용)
                            // 기말 주식수와 지분율 분리
                            // numericPart: "...1,20030" (마지막이 기말데이터)
                            // 콤마가 있다면 마지막 콤마 기준 + 3자리 숫자가 주식수 끝이라고 가정
                            
                            const lastComma = numericPart.lastIndexOf(',');
                            let shares = 0;
                            let ratio = 0;
                            
                            if (lastComma !== -1 && lastComma + 4 <= numericPart.length) {
                                // 콤마 뒤 3자리까지가 주식수 ("1,200")
                                // 그 뒤가 지분율 ("30")
                                // splitIdx: 주식수 끝나는 지점
                                const splitIdx = lastComma + 4;
                                
                                // ratioStr ("30")
                                const ratioStr = numericPart.substring(splitIdx);
                                ratio = parseFloat(ratioStr);

                                // sharesStr ("...1,200")
                                // 앞부분에 기초데이터가 섞여있으므로 뒤에서부터 숫자 덩어리 추출
                                const prefix = numericPart.substring(0, splitIdx);
                                const sharesMatch = prefix.match(/[\d,]+$/);
                                if (sharesMatch) {
                                    shares = parseInt(sharesMatch[0].replace(/,/g, ''), 10);
                                }
                            } else {
                                // 콤마 없을 때 (100주 100% -> 100100)
                                // 뒤에서 2~3자리를 지분율로 가정 (Fallback)
                                const ratioLen = (numericPart.endsWith('100')) ? 3 : 2;
                                const ratioStr = numericPart.slice(-ratioLen);
                                const sharesStr = numericPart.slice(0, -ratioLen);
                                
                                ratio = parseFloat(ratioStr);
                                const sMatch = sharesStr.match(/[\d,]+$/);
                                if (sMatch) shares = parseInt(sMatch[0].replace(/,/g, ''), 10);
                            }

                            if (shares > 0) {
                                shareholders.push({
                                    name: cleanName,
                                    id: `${cleanID.substring(0,6)}-*******`, // 주민번호 마스킹
                                    shares: shares,
                                    ratio: ratio,
                                    relCode: code,
                                    relName: RELATION_CODES[code]
                                });
                                console.log(`   + [주주] ${cleanName} (${RELATION_CODES[code]}) : ${shares}주, ${ratio}%`);
                            }
                        }
                    }
                }
            }
        }
        
        if (shareholders.length > 0) {
             result.data.shareholders = shareholders;
        }
    }
  }

  // 최저한세가 추출되지 않았을 경우 (최저한세조정계산서 부재 등), 과세표준의 7%로 계산
  if (result.data.minTax === 0 && result.data.taxBase > 0) {
    console.log('-> [Info] 최저한세 추출 실패 또는 페이지 부재. 과세표준의 7%로 간주하여 계산합니다.');
    result.data.minTax = Math.floor(result.data.taxBase * 0.07);
  }

  // 계산: 최저한세 적용대상 공제 여분 = 차감세액 - 최저한세
  result.data.minTaxAdjustment = result.data.deductedTax - result.data.minTax;

  console.log('-> 추출 데이터:', result.data);
  return result;
}
