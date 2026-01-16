import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { extractWordsFromPage } from './pdf-processing/common';
import { processWithholdingPDF } from './pdf-processing/withholding';
import { processRegistryPDF } from './pdf-processing/registry';
import { generateExcel } from './pdf-processing/excel';

import { processTaxReturnPDF } from './pdf-processing/tax-return';

// Worker 설정 (CDN 사용 - unpkg가 npm 버전과 일치할 확률이 높음)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export async function processPDF(file) {
  console.log(`\n=== 파일 처리 시작: ${file.name} ===`);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ 
    data: arrayBuffer, 
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true 
  }).promise;
  
  // 첫 페이지를 읽어서 파일 타입 판별
  // 1~3페이지까지 확인 (사용자 요청)
  let isTaxReturn = false;
  let words1 = [];

  for (let i = 1; i <= Math.min(3, pdf.numPages); i++) {
    const page = await pdf.getPage(i);
    const { words } = await extractWordsFromPage(page, i);
    const fullText = words.map(w => w.text).join('');
    const textNoSpace = fullText.replace(/\s/g, '');
    
    if (i === 1) words1 = words; // 원천징수부/등기부는 1페이지만 봐도 됨

    if (textNoSpace.includes('세액신고서')) {
      isTaxReturn = true;
      break;
    }
  }

  const fullText1 = words1.map(w => w.text).join('');
  const textNoSpace1 = fullText1.replace(/\s/g, '');
  
  if (isTaxReturn) {
    console.log('-> [파일유형] 법인세 신고서 감지됨');
    return await processTaxReturnPDF(pdf, file.name);
  } else if (textNoSpace1.includes('인터넷등기') || textNoSpace1.includes('등기사항전부증명서') || textNoSpace1.includes('등기사항일부증명서')) {
    console.log('-> [파일유형] 법인등기부(인터넷등기) 감지됨');
    return await processRegistryPDF(pdf, file.name);
  } else {
    console.log('-> [파일유형] 원천징수부 감지됨 (기본값)');
    return await processWithholdingPDF(pdf, file.name); // words1 제거하여 재추출 유도 (tolerance=5 적용 위해)
  }
}

export { generateExcel };
