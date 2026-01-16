
function findTaxBaseFromFullText(words) {
  // 단어들을 공백으로 연결하여 전체 텍스트 생성
  const fullText = words.map(w => w.text).join(' ');
  
  // "과세표준" 키워드 찾기 (글자 사이 공백 허용)
  const match = fullText.match(/과\s*세\s*표\s*준/);
  
  if (match) {
    // 키워드 이후의 텍스트만 추출
    const textAfter = fullText.substring(match.index + match[0].length);
    
    // 바로 뒤에 나오는 숫자 추출 (콤마 포함)
    const numberMatch = textAfter.match(/^\s*([\d,]+)/);
    
    if (numberMatch) {
      const val = parseInt(numberMatch[1].replace(/,/g, ''), 10);
      console.log(`-> 과세표준 값 발견 (FullText): ${val}`);
      return val;
    }
  }
  return 0;
}

console.log("Syntax check passed");
