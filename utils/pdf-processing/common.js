
// 날짜 정규화 (YYYY-MM-DD)
export function normalizeDate(dateStr) {
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
export async function extractWordsFromPage(page, pageNum) {
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
  return { words, viewport };
}
