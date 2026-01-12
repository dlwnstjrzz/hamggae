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

  // 1. 상호 & 본점 찾기
  let parsingExecutives = false;
  let currentExec = null;

  for (let i = 0; i < allLines.length; i++) {
    const line = allLines[i];
    
    // 상호
    if (!result.companyName && (line.includes('상 호') || line.startsWith('상호'))) {
      // "상 호  주식회사 000" 형태
      const parts = line.split(/상\s*호/);
      if (parts.length > 1) {
        result.companyName = parts[1].trim();
        console.log(`-> 상호: ${result.companyName}`);
      }
    }

    // 본점
    if (!result.address && (line.includes('본 점') || line.startsWith('본점'))) {
      const parts = line.split(/본\s*점/);
      if (parts.length > 1) {
        result.address = parts[1].trim();
        // 다음 줄에 주소가 이어질 수 있음 (행정구역 등)
        // 간단히 현재 줄에서 판단하거나, 다음 줄도 볼 수 있음. 
        // 보통 등기부등본에서 본점은 한 줄 혹은 두 줄.
        // 수도권 판단: 서울, 경기
        const checkAddr = result.address + (allLines[i+1] || '');
        result.isCapitalArea = checkAddr.includes('서울') || checkAddr.includes('경기');
        console.log(`-> 본점: ${result.address} (${result.isCapitalArea ? '수도권' : '비수도권'})`);
      }
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
      // 예: 대표이사 홍길동 123456-*******
      // 예: 감사 홍길동 123456-*******
      const execMatch = line.match(/(사내이사|사외이사|감사|대표이사|이사)\s+([가-힣]+)\s+(\d{6}-[\d*]{7})/);
      
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
        const dateMatch = line.match(/(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*(취임|중임|사임|퇴임|만료)/);
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
