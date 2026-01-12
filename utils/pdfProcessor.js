import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import { extractWordsFromPage } from './pdf-processing/common';
import { processWithholdingPDF } from './pdf-processing/withholding';
import { processRegistryPDF } from './pdf-processing/registry';
import { generateExcel } from './pdf-processing/excel';

// Worker 설정 (CDN 사용 - unpkg가 npm 버전과 일치할 확률이 높음)
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

export async function processPDF(file) {
  console.log(`\n=== 파일 처리 시작: ${file.name} ===`);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  // 첫 페이지를 읽어서 파일 타입 판별
  const page1 = await pdf.getPage(1);
  const { words: words1 } = await extractWordsFromPage(page1, 1);
  const fullText1 = words1.map(w => w.text).join('');
  
  // 인터넷등기 판별 키워드
  if (fullText1.includes('인터넷등기') || fullText1.includes('등기사항전부증명서') || fullText1.includes('등기사항일부증명서')) {
    console.log('-> [파일유형] 법인등기부(인터넷등기) 감지됨');
    return await processRegistryPDF(pdf, file.name);
  } else {
    console.log('-> [파일유형] 원천징수부 감지됨 (기본값)');
    return await processWithholdingPDF(pdf, file.name, words1); // 첫 페이지 words 재사용
  }
}

export { generateExcel };
