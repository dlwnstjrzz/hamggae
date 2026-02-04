'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Upload, Button, Layout, Typography, Card, App, Steps, Divider, Space, Tag, Tabs } from 'antd';
import { InboxOutlined, FilePdfOutlined, DeleteOutlined, RocketOutlined, DownloadOutlined, ReloadOutlined, CheckCircleOutlined, FileExcelOutlined } from '@ant-design/icons';
import { processPDF, generateExcel } from '@/utils/pdfProcessor';
import { parseExcel } from '@/utils/excelParser';
import EmploymentIncreaseCalculator from '@/components/EmploymentIncreaseCalculator';

const { Header, Content, Footer } = Layout;
const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

export default function Home() {
  const { message } = App.useApp();
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [processingTime, setProcessingTime] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState('pdf');

  // PDF Upload Handler
  const customRequestPDF = ({ file, onSuccess }) => {
     setTimeout(() => {
        onSuccess("ok");
        if (file.type !== 'application/pdf') {
             message.error(`${file.name}은(는) PDF 파일이 아닙니다.`);
             return;
        }
        setFiles(prev => {
            if(prev.some(f => f.uid === file.uid)) return prev;
            return [...prev, file];
        });
        setProcessedData(null);
        setCurrentStep(0);
     }, 0);
  };

  // Excel Upload Handler
  const customRequestExcel = async ({ file, onSuccess }) => {
     try {
         console.log('[DEBUG] Uploading Excel:', file.name, file.type);
         const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') || file.type.includes('sheet') || file.type.includes('excel');
         
         if (!isExcel) {
             console.warn('[DEBUG] Invalid Excel file:', file.name, file.type);
             // Verify if it's just a mime type issue
             if (!confirm(`파일 유형(${file.type})이 엑셀과 달라 보입니다. 그래도 진행하시겠습니까?`)) {
                 message.error(`${file.name}은(는) 엑셀 파일이 아닙니다.`);
                 return;
             }
         }
         
         onSuccess("ok");
         setIsProcessing(true);
         const startTime = performance.now();
         const results = await parseExcel(file);
         const endTime = performance.now();
         
         if (results && results.length > 0) {
             setProcessingTime((endTime - startTime) / 1000);
             setProcessedData(results);
             message.success('엑셀 자료를 성공적으로 불러왔습니다.');
             setCurrentStep(2); // Jump to results
         } else {
             message.warning('유효한 데이터가 엑셀에 없습니다.');
         }
     } catch (err) {
         console.error(err);
         message.error('엑셀 파일 처리 중 오류가 발생했습니다.');
     } finally {
         setIsProcessing(false);
     }
  };

  const removeFile = (fileToRemove) => {
    setFiles(prev => prev.filter(f => f.uid !== fileToRemove.uid));
  };

  const handleProcess = async () => {
    if (files.length === 0) {
        message.warning('처리할 파일이 없습니다.');
        return;
    }

    setIsProcessing(true);
    setProcessingTime(null);
    const results = [];
    const startTime = performance.now();

    try {
      for (const file of files) {
        try {
          // processPDF expects a File object
          const data = await processPDF(file);
          results.push(data);
        } catch (err) {
          console.error(`Error processing ${file.name}:`, err);
          message.error(`${file.name} 처리 실패`);
        }
      }
      const endTime = performance.now();
      setProcessingTime((endTime - startTime) / 1000);
      setProcessedData(results);
      message.success('데이터 처리가 완료되었습니다.');
      setCurrentStep(1);
    } catch (err) {
      console.error(err);
      message.error('처리 중 오류가 발생했습니다.');
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
      message.success('다운로드가 시작되었습니다.');
    } catch (err) {
      console.error(err);
      message.error('엑셀 생성 실패');
    }
  };

  const handleReset = () => {
    setFiles([]);
    setProcessedData(null);
    setProcessingTime(null);
    setCurrentStep(0);
    message.info('초기화되었습니다.');
  };

  const totalEmployees = processedData ? processedData.reduce((acc, curr) => acc + (curr.employees?.length || 0) + (curr.executives?.length || 0), 0) : 0;

  const items = [
    {
      key: 'pdf',
      label: 'PDF 원천징수부',
      children: (
        <div className="p-6 min-h-[160px] flex flex-col justify-center">
             <Dragger 
                 name="file" 
                 multiple 
                 customRequest={customRequestPDF}
                 showUploadList={false} 
                 style={{ background: 'transparent', border: '1px dashed #e2e8f0', borderRadius: '8px', padding: '0' }}
                 className="group hover:border-slate-400 transition-colors duration-300"
                 height={140}
             >
                 <div className="flex flex-col items-center justify-center py-6">
                     <div className="mb-3 text-slate-300 group-hover:text-slate-500 transition-colors">
                         <InboxOutlined style={{ fontSize: '24px' }} />
                     </div>
                     <p className="text-slate-600 text-sm font-medium">
                         <span className="text-blue-600 hover:underline">Click to upload</span> or drag PDF here
                     </p>
                 </div>
             </Dragger>

             {/* File List & Actions - Clean Minimalist */}
             {files.length > 0 && (
                 <div className="mt-6 animate-in fade-in slide-in-from-bottom-2">
                     <div className="flex items-center justify-between mb-4">
                         <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Selected Files ({files.length})</span>
                         <Button type="text" size="small" className="text-slate-400 hover:text-red-500" onClick={handleReset}>Clear All</Button>
                     </div>
                     
                     <div className="space-y-2 mb-6 max-h-[150px] overflow-y-auto custom-scrollbar">
                         {files.map((file, index) => (
                             <div key={file.uid || index} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 transition-colors group">
                                 <div className="flex items-center gap-3 overflow-hidden">
                                     <FilePdfOutlined className="text-slate-400 group-hover:text-[#F43099] transition-colors" />
                                     <span className="text-sm text-slate-600 truncate">{file.name}</span>
                                 </div>
                                 <Button type="text" size="small" icon={<DeleteOutlined />} className="text-slate-300 hover:text-red-500" onClick={() => removeFile(file)} />
                             </div>
                         ))}
                     </div>

                     {!processedData ? (
                         <Button 
                             type="primary" 
                             block 
                             size="large"
                             loading={isProcessing} 
                             onClick={handleProcess}
                             style={{ height: '48px', fontSize: '15px' }}
                             className="bg-slate-900 hover:bg-slate-800 border-0 shadow-lg shadow-slate-200"
                         >
                             Start Analysis
                         </Button>
                     ) : (
                         <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                             <div className="flex items-center gap-3">
                                 <CheckCircleOutlined className="text-[#00D3BB]" />
                                 <span className="text-sm font-medium text-slate-700">Analysis Complete</span>
                             </div>
                             <div className="flex gap-2">
                                 <Button type="link" size="small" onClick={handleDownload} className="text-slate-600 hover:text-[#00D3BB] p-0">Download</Button>
                                 <span className="text-slate-200">|</span>
                                 <Button type="link" size="small" onClick={handleReset} className="text-slate-400 hover:text-slate-600 p-0">Reset</Button>
                             </div>
                         </div>
                     )}
                 </div>
             )}
        </div>
      ),
    },
    {
      key: 'excel',
      label: '통합 엑셀 자료',
      children: (
        <div className="p-6 min-h-[160px] flex flex-col justify-center">
             {!processedData ? (
                 <Dragger 
                    name="file"
                    accept=".xlsx, .xls"
                    customRequest={customRequestExcel}
                    showUploadList={false} 
                    style={{ background: 'transparent', border: '1px dashed #e2e8f0', borderRadius: '8px', padding: '0' }}
                    className="group hover:border-slate-400 transition-colors duration-300"
                    height={140}
                >
                    <div className="flex flex-col items-center justify-center py-6">
                        <div className="mb-3 text-slate-300 group-hover:text-slate-500 transition-colors">
                            <FileExcelOutlined style={{ fontSize: '24px' }} />
                        </div>
                        <p className="text-slate-600 text-sm font-medium">
                            <span className="text-blue-600 hover:underline">Click to upload</span> or drag Excel here
                        </p>
                    </div>
                </Dragger>
             ) : (
                 <div className="w-full animate-in fade-in slide-in-from-bottom-2">
                     <div className="flex items-center justify-between p-4 border border-slate-100 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full text-emerald-500">
                                <CheckCircleOutlined />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-slate-800 m-0">Data Ready</h3>
                                <p className="text-xs text-slate-400 m-0 mt-0.5">Report generated below.</p>
                            </div>
                        </div>
                        <Button
                            type="text"
                            size="small"
                            onClick={handleReset}
                            className="text-slate-400 hover:text-black"
                        >
                            Reset
                        </Button>
                     </div>
                 </div>
             )}
        </div>
      ),
    },
  ];

  return (
    <Layout className="relative bg-white" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* SaaS Background Effect */}
      {/* Global Background Grid - Fixed */}
      {/* Global Background Grid - Pattern Only, Stops after Form */}
      <div className="absolute inset-0 z-0 pointer-events-none w-full h-[1100px] bg-white">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:60px_60px]"></div>
      </div>
      
      {/* Global Strong Vertical Lines Overlay (Persists Everywhere) */}
      <div className="absolute inset-0 z-20 pointer-events-none w-full h-full">
          <div className="max-w-[1200px] mx-auto h-full border-x border-gray-300/80"></div>
      </div>
      
      <Header 
        className="sticky top-0 z-50 w-full transition-all"
        style={{ 
            paddingInline: 24, 
            paddingLeft: 'max(24px, calc((100% - 1200px) / 2))', 
            paddingRight: 'max(24px, calc((100% - 1200px) / 2))', 
            height: '80px', 
            display: 'flex', 
            alignItems: 'center',
            background: 'rgba(255,255,255,0.5)',
            backdropFilter: 'blur(12px)',
            borderBottom: 'none' // Remove border for seamless blend
        }}
      >
        <div className="flex w-full items-center">
            {/* Left Spacer */}
            <div className="flex-1"></div>

            {/* Center: Logo */}
            <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.location.reload()}>
                <div className="relative w-24 h-12">
                    <Image 
                        src="/logo2.png" 
                        alt="TAXGO Logo" 
                        fill 
                        style={{ objectFit: 'contain' }}
                        priority
                    />
                </div>
            </div>

            {/* Right: Sign Up Only */}
            <div className="flex-1 flex justify-end">
                <Button type="primary" className="bg-black hover:bg-slate-800 text-white font-medium h-9 px-4 rounded-md shadow-sm border-0">
                    Sign Up
                </Button>
            </div>
        </div>
      </Header>
      
      <Content style={{ width: '100%', flex: 1, position: 'relative', zIndex: 1 }}>
        
        <div className="max-w-[1200px] mx-auto px-6 pt-[20px] pb-36">
            <div className="mx-auto max-w-2xl text-center pt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                 <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 mb-6 shadow-sm">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-black mr-2 animate-pulse"></span>
                    Beta v1.0.0
                 </div>
                 <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl mb-6" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    세무 경정청구를 <br/>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">완벽하게 자동화하세요.</span>
                 </h1>
            </div>
        </div>

        {/* Recessed Tab Separator & Steps */}
        <div className="relative z-10 w-full bg-neutral-100 pointer-events-none">
            <div className="flex justify-center items-end -mt-[64px] relative z-20">
                
                {/* Left Curve SVG */}
                <div className="text-white h-[64px] w-auto shrink-0 translate-y-[1px]">
                    <svg viewBox="0 0 85 64" fill="none" className="h-full w-auto">
                        <path d="M50 45C57.3095 56.6952 71.2084 63.9997 85 64V0H0C13.7915 0 26.6905 7.30481 34 19L50 45Z" fill="currentColor"></path>
                    </svg>
                </div>

                {/* Center Content Area */}
                <div className="h-[64px] bg-white border-t border-transparent relative min-w-[300px] px-8 flex items-center justify-center pointer-events-auto">
                    
                    {/* Step Items - Static Process Flow */}
                    <div className="flex items-center justify-center gap-4 relative z-10 select-none">
                        {/* Step 1: Upload (#F43099) */}
                        <div className={`
                            flex items-center gap-2.5 transition-colors duration-300
                            ${currentStep >= 0 ? 'text-slate-800' : 'text-slate-400'}
                        `}>
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ring-4 ring-white
                                ${currentStep >= 0 
                                    ? 'bg-[#F43099]/10 text-[#F43099] shadow-[0_2px_10px_-2px_rgba(244,48,153,0.3)]' 
                                    : 'bg-slate-50 text-slate-300'}
                            `}>
                                {/* Icon: Upload Cloud / File */}
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                                    <path d="M12 12v9" />
                                    <path d="m16 16-4-4-4 4" />
                                </svg>
                            </div>
                            <span className="text-[13px] font-semibold tracking-wide uppercase">Upload</span>
                        </div>

                        {/* Divider Chevron */}
                        <div className="text-slate-200">
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6"/>
                             </svg>
                        </div>

                        {/* Step 2: Analyze (#615EFF) */}
                        <div className={`
                            flex items-center gap-2.5 transition-colors duration-300
                            ${currentStep >= 1 ? 'text-slate-800' : 'text-slate-400'}
                        `}>
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ring-4 ring-white
                                ${currentStep >= 1
                                    ? 'bg-[#615EFF]/10 text-[#615EFF] shadow-[0_2px_10px_-2px_rgba(97,94,255,0.3)]' 
                                    : 'bg-slate-50 text-slate-300'}
                            `}>
                                {/* Icon: Sparkles / Magic */}
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                                </svg>
                            </div>
                            <span className="text-[13px] font-semibold tracking-wide uppercase">Analyze</span>
                        </div>

                        {/* Divider Chevron */}
                        <div className="text-slate-200">
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6"/>
                             </svg>
                        </div>

                        {/* Step 3: Report (#00D3BB) */}
                        <div className={`
                            flex items-center gap-2.5 transition-colors duration-300
                            ${currentStep >= 2
                                ? 'text-slate-800' : 'text-slate-400'}
                        `}>
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ring-4 ring-white
                                ${currentStep >= 2
                                    ? 'bg-[#00D3BB]/10 text-[#00D3BB] shadow-[0_2px_10px_-2px_rgba(0,211,187,0.3)]' 
                                    : 'bg-slate-50 text-slate-300'}
                            `}>
                                {/* Icon: File Bar Chart */}
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <path d="M12 18v-4" />
                                    <path d="M8 18v-2" />
                                    <path d="M16 18v-6" />
                                </svg>
                            </div>
                            <span className="text-[13px] font-semibold tracking-wide uppercase">Report</span>
                        </div>
                    </div>
                </div>

                {/* Right Curve SVG */}
                <div className="text-white h-[64px] w-auto shrink-0 translate-y-[1px] -scale-x-100">
                    <svg viewBox="0 0 85 64" fill="none" className="h-full w-auto">
                        <path d="M50 45C57.3095 56.6952 71.2084 63.9997 85 64V0H0C13.7915 0 26.6905 7.30481 34 19L50 45Z" fill="currentColor"></path>
                    </svg>
                </div>
            </div>
        </div>

        {/* Bottom Section - Gray Band with Strong Grid Lines */}
        <div className="relative bg-neutral-100 pt-12 pb-32 -mt-[1px] z-10 border-b border-gray-300">
            {/* Conic Gradient Effect - Subtle & Soft */}
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-3/4 w-[1600px] -translate-x-1/2 opacity-[0.08] blur-[200px] bg-[conic-gradient(from_-81deg,#F00,#EAB308_99deg,#5CFF80_162deg,#00FFF9_216deg,#3A8BFD_288deg,#855AFC)]"></div>

            <div className="max-w-4xl mx-auto px-6 relative z-10">
                {/* Upload/Dashboard Content - Shadcn Style */}
                <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
                    <div className="p-6 md:p-8 min-h-[400px] flex flex-col">
                        


                        {/* Tabs (Segmented Control Style) */}
                        <div className="grid w-full grid-cols-2 h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 mb-8 self-center max-w-[400px]">
                            <button
                                onClick={() => setActiveTab('pdf')}
                                className={`
                                    inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
                                    ${activeTab === 'pdf' ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-200/50 hover:text-slate-900'}
                                `}
                            >
                                PDF 원천징수부
                            </button>
                            <button
                                onClick={() => setActiveTab('excel')}
                                className={`
                                    inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
                                    ${activeTab === 'excel' ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-200/50 hover:text-slate-900'}
                                `}
                            >
                                통합 엑셀 자료
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1">
                            {activeTab === 'pdf' ? (
                                <div className="space-y-6">
                                    {/* PDF Upload Area */}
                                    <div className="flex items-center justify-center w-full">
                                        <label htmlFor="pdf-upload" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <InboxOutlined className="text-4xl text-slate-400 mb-4" />
                                                <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                            </div>
                                            <input 
                                                id="pdf-upload" 
                                                type="file" 
                                                multiple
                                                accept=".pdf"
                                                className="hidden" 
                                                onChange={(e) => {
                                                    if (e.target.files) {
                                                        const newFiles = Array.from(e.target.files).map(file => {
                                                            file.uid = Math.random().toString(36).substring(7);
                                                            return file;
                                                        });
                                                        setFiles(prev => [...prev, ...newFiles]);
                                                        e.target.value = ''; 
                                                    }
                                                }}
                                            />
                                        </label>
                                    </div>

                                    {/* File List & Actions */}
                                    {files.length > 0 && (
                                        <div className="animate-in fade-in zoom-in-95 duration-200 space-y-4 max-w-2xl mx-auto pt-4 border-t border-slate-100">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-semibold tracking-tight">Selected Files ({files.length})</h4>
                                                <button 
                                                    onClick={handleReset}
                                                    className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                                                >
                                                    Clear All
                                                </button>
                                            </div>

                                            <div className="max-h-[200px] overflow-y-auto rounded-md border border-slate-200 p-1">
                                                {files.map((file, i) => (
                                                    <div key={file.uid || i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-sm group transition-colors">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-red-500 transition-colors">
                                                                <FilePdfOutlined />
                                                            </div>
                                                            <span className="text-sm font-medium truncate max-w-[200px] md:max-w-[300px]">{file.name}</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => removeFile(file)}
                                                            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                                        >
                                                            <DeleteOutlined />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {!processedData ? (
                                                <button 
                                                    onClick={handleProcess}
                                                    disabled={isProcessing}
                                                    className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 hover:bg-slate-900/90 h-10 px-4 py-2 w-full"
                                                >
                                                    {isProcessing ? (
                                                        <>
                                                            <span className="loading loading-spinner loading-xs mr-2"></span>
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        'Start Analysis'
                                                    )}
                                                </button>
                                            ) : (
                                                <div className="rounded-md border border-slate-200 bg-slate-50 p-4 flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-green-600">
                                                        <CheckCircleOutlined className="text-xl" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h5 className="text-sm font-medium leading-none">Analysis Complete</h5>
                                                        <p className="text-sm text-slate-500 mt-1">
                                                            {processedData.length} files processed. Check the report below.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={handleReset}
                                                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-9 px-3"
                                                        >
                                                            Reset
                                                        </button>
                                                        <button 
                                                            onClick={handleDownload}
                                                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-9 px-3"
                                                        >
                                                            Download
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                     {!processedData ? (

                                        <div className="flex items-center justify-center w-full">
                                            <label htmlFor="excel-upload" className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                    <FileExcelOutlined className="text-4xl text-emerald-500 mb-4" />
                                                    <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                </div>
                                                <input 
                                                    id="excel-upload" 
                                                    type="file" 
                                                    accept=".xlsx, .xls"
                                                    className="hidden" 
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            customRequestExcel({ file: e.target.files[0], onSuccess: () => {} });
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="card border border-base-300 shadow-sm animate-in zoom-in-95 duration-300">
                                            <div className="card-body items-center text-center p-8">
                                                <div className="text-primary mb-2">
                                                    <CheckCircleOutlined style={{ fontSize: '48px' }} />
                                                </div>
                                                <h3 className="card-title text-lg font-bold">Data Ready</h3>
                                                <p className="text-base-content/60 text-sm">
                                                    Data loaded successfully. Report generated below.
                                                </p>
                                                <div className="card-actions mt-4">
                                                    <button 
                                                        onClick={handleReset}
                                                        className="btn btn-outline btn-sm px-8"
                                                    >
                                                        Upload New File
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>

        {/* Spacer to return to white background */}
        <div className="relative z-10 w-full h-24 bg-white"></div>
        
        {/* Analysis Results Section - Explicit White Background */}
        {processedData && (processedData.length > 0) && (
            <div className="w-full bg-white relative z-10 pb-32">
                <div className="max-w-[1200px] mx-auto px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <EmploymentIncreaseCalculator initialData={processedData} />
                </div>
            </div>
        )}

        {/* Global lines persist due to z-20 overlay */}
        
      </Content>
      <Footer style={{ textAlign: 'center', color: '#999', background: 'white' }}>
        TAXGO ©2025 Created for Tax Professionals
      </Footer>
    </Layout>
  );
}
