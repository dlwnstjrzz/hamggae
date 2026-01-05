'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { processPDF, generateExcel } from '@/utils/pdfProcessor';
import clsx from 'clsx';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...newFiles]);
      setProcessedData(null); // Reset results on new files
      setError(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...newFiles]);
      setProcessedData(null);
      setError(null);
    }
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setError(null);
    const results = [];

    try {
      for (const file of files) {
        try {
          const data = await processPDF(file);
          results.push(data);
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err);
          // 개별 파일 에러는 무시하고 진행하거나 표시
        }
      }
      setProcessedData(results);
    } catch (err) {
      console.error(err);
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!processedData) return;
    
    try {
      const buffer = await generateExcel(processedData);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '사원자료_통합.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setError('엑셀 생성 중 오류가 발생했습니다.');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setProcessedData(null);
    setError(null);
  };

  const totalEmployees = processedData ? processedData.reduce((acc, curr) => acc + curr.employees.length, 0) : 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-4">
            원천징수부 데이터 추출기
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            PDF 원천징수부 파일을 업로드하면 자동으로 데이터를 추출하여 엑셀로 변환해줍니다.
            <br />
            <span className="text-sm text-slate-500 mt-2 block">
              (모든 처리는 브라우저 내에서 이루어지며 서버로 전송되지 않습니다)
            </span>
          </p>
        </header>

        {/* Main Content */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          
          {/* Upload Area */}
          <div 
            className="p-10 border-b border-slate-100 bg-slate-50/50 transition-colors hover:bg-slate-50"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-all group cursor-pointer relative">
              <input 
                type="file" 
                multiple 
                accept=".pdf" 
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="p-4 bg-white rounded-full shadow-sm ring-1 ring-slate-200 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-semibold text-slate-800 mb-1">
                    PDF 파일을 여기에 드래그하거나 클릭하세요
                  </p>
                  <p className="text-slate-500">
                    여러 파일을 한 번에 선택할 수 있습니다
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* File List & Actions */}
          <div className="p-8">
            {files.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-500" />
                    선택된 파일 ({files.length})
                  </h3>
                  <button 
                    onClick={handleReset}
                    className="text-sm text-red-500 hover:text-red-700 font-medium flex items-center gap-1 px-3 py-1 rounded-full hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    전체 삭제
                  </button>
                </div>

                <div className="grid gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-colors">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-slate-200 text-xs font-bold text-red-500">
                          PDF
                        </div>
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[300px]">
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-400">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <button 
                        onClick={() => removeFile(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                  {!processedData ? (
                    <button
                      onClick={handleProcess}
                      disabled={isProcessing}
                      className={clsx(
                        "w-full py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2",
                        isProcessing 
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-blue-600/30 hover:-translate-y-0.5"
                      )}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          데이터 추출 중...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-5 h-5" />
                          데이터 추출 시작
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="p-4 bg-green-50 border border-green-100 rounded-xl flex items-center gap-3 text-green-800">
                        <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                        <div>
                          <p className="font-bold">처리가 완료되었습니다!</p>
                          <p className="text-sm text-green-700">
                            총 {processedData.length}개 파일에서 {totalEmployees}명의 사원 정보를 추출했습니다.
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          onClick={handleDownload}
                          className="flex-1 py-4 bg-green-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/20 hover:bg-green-700 hover:shadow-green-600/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                        >
                          <Download className="w-5 h-5" />
                          엑셀 다운로드
                        </button>
                        <button
                          onClick={handleReset}
                          className="px-6 py-4 bg-white text-slate-600 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 hover:text-slate-900 transition-colors"
                        >
                          처음으로
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-800 animate-in fade-in">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      {error}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <p>파일이 선택되지 않았습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
