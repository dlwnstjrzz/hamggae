import { extractWordsFromPage } from './common';

export async function processRegistryPDF(pdf, filename) {
  const result = {
    type: 'registry',
    filename,
    companyName: '',
    address: '',
    isCapitalArea: false,
    executives: []
  };

  let allLines = [];

  // 모든 페이지 텍스트 추출 및 라인 단위 통합
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const { words } = await extractWordsFromPage(page, i + 1);
    
    // Y좌표 기준으로 라인 그룹화
    const lines = [];
    if (words.length > 0) {
      let currentLine = [words[0]];
      for (let j = 1; j < words.length; j++) {
        const w = words[j];
        const prev = currentLine[currentLine.length - 1];
        if (Math.abs(w.top - prev.top) < 10) { // 같은 라인
          currentLine.push(w);
        } else {
          lines.push(currentLine);
          currentLine = [w];
        }
      }
      lines.push(currentLine);
    }
    
    // 라인별 텍스트로 변환
    const lineTexts = lines.map(line => line.map(w => w.text).join(' ').trim());
    allLines = allLines.concat(lineTexts);
  }

  console.log(`-> 총 ${allLines.length}줄의 텍스트 추출됨`);

  // [DEBUG] 전체 텍스트 라인 출력 (사용자 요청: FullText 확인)
  console.log("=== [DEBUG] ALL TEXT LINES START ===");
  allLines.forEach((l, idx) => console.log(`[Line ${idx}] "${l}"`));
  console.log("=== [DEBUG] ALL TEXT LINES END ===");

  // 1. 상호 & 본점 찾기
  let parsingExecutives = false;
  let parsingAddress = false;
  let currentExec = null;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    
    // 상호 (Company Name)
    // 패턴: (번호) 상 (공백) 호 (공백) (값)
    // 예: "1. 상호 주식회사 금오테크", "상 호  주식회사 금오테크"
    if (!result.companyName) {
        // 정규식: (번호 등 잡동사니)(상\s*호)(공백/특수문자)(값)
        const nameMatch = line.match(/(?:^|\s|\d+\.?)\s*(상\s*호)\s*[:]?\s*(.*)/);
        
        if (nameMatch) {
            console.log(`[DEBUG] 상호 라인 감지: "${line}"`);
            let rawName = nameMatch[2].trim();
            
            // "..", "등기" 등 불필요한 뒷부분 제거 (사용자 로그 기반 보정)
            // 예: "주식회사 금오테크 .. 등기" -> "주식회사 금오테크"
            // "등기" 라는 단어가 뒤에 오면 그 앞까지만 추출
            if (rawName.includes('등기')) {
                rawName = rawName.split('등기')[0].trim();
            }
            // ".." 제거
            rawName = rawName.replace(/\.\.+/g, '').trim();

            if (rawName.length > 0) {
                result.companyName = rawName;
                console.log(`-> 상호 추출 성공(Regex): ${result.companyName}`);
            }
        }
    }

    // 본점 (Address)
    // 1. "본점" 키워드 라인 처리
    // "2. 본점" 처럼 앞에 번호가 있는 경우를 위해 startsWith 대신 includes 사용
    if (line.includes('본점') || line.includes('본 점')) {
        parsingAddress = true; // 본점 섹션 진입
        
        const addrMatch = line.match(/(?:^|\s|\d+\.?)\s*(본\s*점)\s*[:]?\s*(.*)/);
        if (addrMatch) {
            let rawAddr = addrMatch[2].trim();
            // 뒷부분(날짜, 등기 등) 제거 로직이 필요할 수 있음
            // 예: "... 경기도 ... 2024.01.01 등기" -> 날짜 앞까지만
            // 일단 단순 제거
            rawAddr = rawAddr.replace(/\d{4}\.\d{2}\.\d{2}.*등기/, '').trim();
            rawAddr = rawAddr.replace(/\.\.+/g, '').trim();

            if (rawAddr.length > 2) {
                result.address = rawAddr;
                console.log(`-> 본점(초기) 추출: ${result.address}`);
            }
        }
    } else if (parsingAddress) {
        // 2. 본점 섹션 내 추가 변경 이력 처리 (Line 5, 6 같은 케이스)
        // 섹션 종료 조건 확인 (다른 섹션 헤더 등장 시)
        if (line.includes('공고방법') || line.includes('자본금') || line.includes('목적') || line.includes('임원에 관한 사항')) {
            parsingAddress = false;
        } else {
            // 변경 이력 패턴: 날짜 + (변경|경정) + 주소 + 날짜 + 등기
            // 예: "2024.06.27 경정 경기도 ... 86-6 2024.06.27 등기"
            // 또는: "20XX.XX.XX 변경 ..."
            const updateMatch = line.match(/^\d{4}\.\d{2}\.\d{2}\s*(?:변경|경정)\s+(.*)\s+\d{4}\.\d{2}\.\d{2}\s*등기/);
            if (updateMatch) {
                let newAddr = updateMatch[1].trim();
                newAddr = newAddr.replace(/\.\.+/g, '').trim();
                
                // 주소 확인 (쉼표로 구분된 경우 뒤에꺼가 주소가 아닐 수도 있음. 하지만 등기부등본은 보통 풀주소)
                if (newAddr.length > 5) { 
                    result.address = newAddr;
                    console.log(`-> 본점(변경이력) 업데이트: ${result.address}`);
                }
            }
        }
    }

    // 최종적으로 수도권 여부 판별 (주소가 업데이트 될 때마다, 혹은 마지막에 한 번 체크)
    if (result.address) {
         let fullAddr = result.address;
         result.isCapitalArea = fullAddr.includes('서울') || fullAddr.includes('경기') || fullAddr.includes('인천');
    }

    // 임원에 관한 사항 시작 감지
    if (line.includes('임원에 관한 사항')) {
      parsingExecutives = true;
      console.log('-> 임원 정보 파싱 시작');
      continue;
    }

    // 다른 섹션 시작되면 중단 (예: 기타 사항 등, 보통 번호로 섹션 구분됨)
    // "4. 기타" 이런 식. 하지만 명확치 않으니 끝까지 가거나 특정 키워드로 종료
    if (parsingExecutives) {
      if (line.includes('기타사항') || line.includes('발행주식')) {
        // parsingExecutives = false; // 등기부 양식이 다양하므로 계속 읽는게 나을수도 있음
      }

      // 임원 패턴: [직위] [이름] [주민번호]
      // 예: 사내이사 홍길동 123456-*******
      // 직위가 더 길거나 (공동대표이사, 기타비상무이사 등), 띄어쓰기가 없을 수도 있음
      const execMatch = line.match(/(사내이사|사외이사|감사|대표이사|공동대표이사|이사|기타비상무이사|감사위원)\s*([^0-9]+?)\s+(\d{6}-[\d*]{7})/);
      
      if (execMatch) {
        // 새로운 임원 발견 -> 이전 임원 저장
        if (currentExec) {
          result.executives.push(currentExec);
        }
        currentExec = {
          position: execMatch[1],
          name: execMatch[2],
          id: execMatch[3],
          history: []
        };
      } else if (currentExec) {
        // 날짜 및 이벤트 파싱
        // 2014 년 06 월 26 일 취임
        const dateMatch = line.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(취임|중임|사임|퇴임|만료|해임)/);
        if (dateMatch) {
          currentExec.history.push({
            date: `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`,
            type: dateMatch[4]
          });
        }
      }
    }
  }
  
  // 마지막 임원 저장
  if (currentExec) {
    result.executives.push(currentExec);
  }

  // 임원 데이터 정리 (시작일, 종료일 계산)
  result.executives = result.executives.map(exec => {
    // 날짜순 정렬
    exec.history.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    let startDate = null;
    let endDate = null; // null means 'Present' or 'Unknown'

    if (exec.history.length > 0) {
      // 첫 기록이 시작일
      startDate = exec.history[0].date;
      
      // 마지막 기록 확인
      const lastEvent = exec.history[exec.history.length - 1];
      if (['사임', '퇴임', '만료', '해임'].includes(lastEvent.type)) {
        endDate = lastEvent.date;
      }
    }

    return {
      ...exec,
      startDate,
      endDate
    };
  });

  console.log(`-> 임원 ${result.executives.length}명 추출 완료`);
  return result;
}
