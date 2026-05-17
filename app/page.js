'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button, Layout, Typography, App } from 'antd';
import {
    InboxOutlined,
    FilePdfOutlined,
    DeleteOutlined,
    DownloadOutlined,
    CheckCircleOutlined,
    FileExcelOutlined,
} from '@ant-design/icons';
import { processPDF, generateExcel } from '@/utils/pdfProcessor';
import { parseExcel } from '@/utils/excelParser';
import { supabase } from '@/utils/supabase';
import {
    getCalculationSessionById,
    getCalculationSessionErrorMessage,
    saveCalculationSession,
} from '@/utils/calculationSessions';
import EmploymentIncreaseCalculator from '@/components/EmploymentIncreaseCalculator';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

const createDefaultSessionTitle = () => `경정청구 계산 ${new Date().toLocaleString('ko-KR')}`;
const CURRENT_SESSION_STORAGE_KEY = 'taxgo-current-session';

export default function Home() {
    const { message } = App.useApp();
    const router = useRouter();

    const [user, setUser] = useState(null);
    const [authResolved, setAuthResolved] = useState(false);
    const [files, setFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processedData, setProcessedData] = useState(null);
    const [processingTime, setProcessingTime] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [activeTab, setActiveTab] = useState('pdf');
    const [calculatorState, setCalculatorState] = useState(null);
    const [restoredSessionState, setRestoredSessionState] = useState(null);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [activeSessionTitle, setActiveSessionTitle] = useState(null);
    const [calculatorRenderKey, setCalculatorRenderKey] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [loadingSessionId, setLoadingSessionId] = useState(null);
    const loadedSessionIdRef = useRef(null);

    const persistCurrentSession = (sessionId, title) => {
        if (typeof window === 'undefined') return;

        if (!sessionId || !title) {
            window.localStorage.removeItem(CURRENT_SESSION_STORAGE_KEY);
            return;
        }

        window.localStorage.setItem(
            CURRENT_SESSION_STORAGE_KEY,
            JSON.stringify({ id: sessionId, title })
        );
    };

    useEffect(() => {
        let mounted = true;

        const syncSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!mounted) return;
            setUser(session?.user ?? null);
            setAuthResolved(true);
        };

        syncSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setAuthResolved(true);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const sessionId = new URLSearchParams(window.location.search).get('session');
        if (!sessionId || !user) return;
        if (loadedSessionIdRef.current === sessionId) return;

        const loadSavedSession = async () => {
            loadedSessionIdRef.current = sessionId;
            setLoadingSessionId(sessionId);
            const { data, error } = await getCalculationSessionById(sessionId);

            if (error) {
                loadedSessionIdRef.current = null;
                console.error(error);
                message.error(getCalculationSessionErrorMessage(error, '저장된 계산을 불러오지 못했습니다.'));
                setLoadingSessionId(null);
                return;
            }

            setProcessedData(data.source_data || []);
            setCalculatorState(data.calculator_state || null);
            setRestoredSessionState(data.calculator_state || null);
            setActiveSessionId(data.id);
            setActiveSessionTitle(data.title || null);
            persistCurrentSession(data.id, data.title || null);
            setFiles([]);
            setCurrentStep(2);
            setActiveTab('excel');
            setCalculatorRenderKey((prev) => prev + 1);
            setLoadingSessionId(null);
            message.success('저장된 계산을 불러왔습니다.');
            window.history.replaceState({}, '', '/');
        };

        loadSavedSession();
    }, [message, user]);

    const customRequestPDF = ({ file, onSuccess }) => {
        setTimeout(() => {
            onSuccess('ok');
            if (file.type !== 'application/pdf') {
                message.error(`${file.name}은(는) PDF 파일이 아닙니다.`);
                return;
            }
            setFiles((prev) => {
                if (prev.some((item) => item.uid === file.uid)) return prev;
                return [...prev, file];
            });
            setProcessedData(null);
            setCalculatorState(null);
            setRestoredSessionState(null);
            setActiveSessionId(null);
            setActiveSessionTitle(null);
            persistCurrentSession(null, null);
            loadedSessionIdRef.current = null;
            setCurrentStep(0);
        }, 0);
    };

    const customRequestExcel = async ({ file, onSuccess }) => {
        try {
            const isExcel =
                file.name.toLowerCase().endsWith('.xlsx') ||
                file.name.toLowerCase().endsWith('.xls') ||
                file.type.includes('sheet') ||
                file.type.includes('excel');

            if (!isExcel) {
                if (!confirm(`파일 유형(${file.type})이 엑셀과 달라 보입니다. 그래도 진행하시겠습니까?`)) {
                    message.error(`${file.name}은(는) 엑셀 파일이 아닙니다.`);
                    return;
                }
            }

            onSuccess('ok');
            setIsProcessing(true);
            const startTime = performance.now();
            const results = await parseExcel(file);
            const endTime = performance.now();

            if (results && results.length > 0) {
                setProcessingTime((endTime - startTime) / 1000);
                setProcessedData(results);
                setCalculatorState(null);
                setRestoredSessionState(null);
                setActiveSessionId(null);
                setActiveSessionTitle(null);
                persistCurrentSession(null, null);
                loadedSessionIdRef.current = null;
                setCurrentStep(2);
                setCalculatorRenderKey((prev) => prev + 1);
                message.success('엑셀 자료를 성공적으로 불러왔습니다.');
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
        setFiles((prev) => prev.filter((file) => file.uid !== fileToRemove.uid));
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
                    const data = await processPDF(file);
                    results.push(data);
                } catch (err) {
                    console.error(`Error processing ${file.name}:`, err);
                    message.error(`${file.name} 처리 실패`);
                }
            }

            const buffer = await generateExcel(results);
            const mockFile = new File([buffer], 'integrated_temp.xlsx', {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const parsedExcelData = await parseExcel(mockFile);
            const taxReturns = results.filter((result) => result.type === 'taxReturn');
            const finalData = [...parsedExcelData, ...taxReturns];

            const endTime = performance.now();
            setProcessingTime((endTime - startTime) / 1000);
            setProcessedData(finalData);
            setCalculatorState(null);
            setRestoredSessionState(null);
            setActiveSessionId(null);
            setActiveSessionTitle(null);
            persistCurrentSession(null, null);
            loadedSessionIdRef.current = null;
            setCurrentStep(1);
            setCalculatorRenderKey((prev) => prev + 1);
            message.success('데이터 처리가 완료되었습니다.');
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
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = '사원자료_통합.xlsx';
            anchor.click();
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
        setCalculatorState(null);
        setRestoredSessionState(null);
        setActiveSessionId(null);
        setActiveSessionTitle(null);
        persistCurrentSession(null, null);
        loadedSessionIdRef.current = null;
        setCurrentStep(0);
        setCalculatorRenderKey((prev) => prev + 1);
        message.info('초기화되었습니다.');
    };

    const handleGoogleSignIn = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });

        if (error) {
            console.error(error);
            message.error('구글 로그인 시작에 실패했습니다.');
        }
    };

    const handleSave = async () => {
        if (!user) {
            message.warning('구글 로그인 후 저장할 수 있습니다.');
            return;
        }

        if (!processedData || !calculatorState) {
            message.warning('저장할 계산 결과가 아직 준비되지 않았습니다.');
            return;
        }

        const inputTitle = window.prompt('저장 이름을 입력해주세요.', createDefaultSessionTitle());
        if (inputTitle === null) return;

        const title = inputTitle.trim() || createDefaultSessionTitle();
        setIsSaving(true);

        const { data, error } = await saveCalculationSession({
            sessionId: activeSessionId,
            userId: user.id,
            title,
            sourceData: processedData,
            calculatorState,
        });

        if (error) {
            console.error(error);
            message.error(getCalculationSessionErrorMessage(error, '계산 저장에 실패했습니다.'));
        } else {
            setActiveSessionId(data.id);
            setActiveSessionTitle(title);
            persistCurrentSession(data.id, title);
            message.success('계산 결과를 저장했습니다.');
        }

        setIsSaving(false);
    };

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error(error);
            message.error('로그아웃에 실패했습니다.');
            return;
        }
        message.success('로그아웃되었습니다.');
    };

    useEffect(() => {
        if (authResolved && user === null) {
            router.replace('/login');
        }
    }, [authResolved, router, user]);

    if (!authResolved || !user) return null;

    return (
        <Layout className="relative bg-white" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div className="absolute inset-0 z-0 pointer-events-none w-full h-[1100px] bg-white">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:60px_60px]"></div>
            </div>

            <div className="absolute inset-0 z-20 pointer-events-none w-full h-full">
                <div className="max-w-[1200px] mx-auto h-full border-x border-gray-300/80"></div>
            </div>

            <Header
                className="z-50 w-full transition-all"
                style={{
                    paddingInline: 24,
                    paddingLeft: 'max(24px, calc((100% - 1200px) / 2))',
                    paddingRight: 'max(24px, calc((100% - 1200px) / 2))',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.5)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: 'none',
                }}
            >
                <div className="flex w-full items-center">
                    <div className="flex-1"></div>

                    <div className="flex items-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => window.location.reload()}>
                        <div className="relative w-24 h-12">
                            <Image src="/logo2.png" alt="TAXGO Logo" fill style={{ objectFit: 'contain' }} priority />
                        </div>
                    </div>

                    <div className="flex-1 flex justify-end">
                        <div className="flex items-center gap-2 pointer-events-auto">
                            {processedData && (
                                <Button
                                    type="default"
                                    loading={isSaving}
                                    className="h-9 px-4 rounded-md"
                                    onClick={handleSave}
                                >
                                    저장
                                </Button>
                            )}
                            {user ? (
                                <>
                                    <Link href="/my">
                                        <Button type="default" className="h-9 px-4 rounded-md">
                                            내 페이지
                                        </Button>
                                    </Link>
                                    <Button
                                        type="primary"
                                        className="bg-black hover:bg-slate-800 text-white font-medium h-9 px-4 rounded-md shadow-sm border-0"
                                        onClick={handleSignOut}
                                    >
                                        로그아웃
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    type="primary"
                                    className="bg-black hover:bg-slate-800 text-white font-medium h-9 px-4 rounded-md shadow-sm border-0"
                                    onClick={handleGoogleSignIn}
                                >
                                    Google Login
                                </Button>
                            )}
                        </div>
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
                            세무 경정청구를 <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">완벽하게 자동화하세요.</span>
                        </h1>
                    </div>
                </div>

                <div className="relative z-10 w-full bg-neutral-100 pointer-events-none">
                    <div className="flex justify-center items-end -mt-[64px] relative z-20">
                        <div className="text-white h-[64px] w-auto shrink-0 translate-y-[1px]">
                            <svg viewBox="0 0 85 64" fill="none" className="h-full w-auto">
                                <path d="M50 45C57.3095 56.6952 71.2084 63.9997 85 64V0H0C13.7915 0 26.6905 7.30481 34 19L50 45Z" fill="currentColor"></path>
                            </svg>
                        </div>

                        <div className="h-[64px] bg-white border-t border-transparent relative min-w-[300px] px-8 flex items-center justify-center pointer-events-auto">
                            <div className="flex items-center justify-center gap-4 relative z-10 select-none">
                                <div className={`flex items-center gap-2.5 transition-colors duration-300 ${currentStep >= 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ring-4 ring-white ${currentStep >= 0 ? 'bg-[#F43099]/10 text-[#F43099] shadow-[0_2px_10px_-2px_rgba(244,48,153,0.3)]' : 'bg-slate-50 text-slate-300'}`}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                                            <path d="M12 12v9" />
                                            <path d="m16 16-4-4-4 4" />
                                        </svg>
                                    </div>
                                    <span className="text-[13px] font-semibold tracking-wide uppercase">Upload</span>
                                </div>

                                <div className="text-slate-200">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </div>

                                <div className={`flex items-center gap-2.5 transition-colors duration-300 ${currentStep >= 1 ? 'text-slate-800' : 'text-slate-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ring-4 ring-white ${currentStep >= 1 ? 'bg-[#615EFF]/10 text-[#615EFF] shadow-[0_2px_10px_-2px_rgba(97,94,255,0.3)]' : 'bg-slate-50 text-slate-300'}`}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                                        </svg>
                                    </div>
                                    <span className="text-[13px] font-semibold tracking-wide uppercase">Analyze</span>
                                </div>

                                <div className="text-slate-200">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="m9 18 6-6-6-6" />
                                    </svg>
                                </div>

                                <div className={`flex items-center gap-2.5 transition-colors duration-300 ${currentStep >= 2 ? 'text-slate-800' : 'text-slate-400'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ring-4 ring-white ${currentStep >= 2 ? 'bg-[#00D3BB]/10 text-[#00D3BB] shadow-[0_2px_10px_-2px_rgba(0,211,187,0.3)]' : 'bg-slate-50 text-slate-300'}`}>
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

                        <div className="text-white h-[64px] w-auto shrink-0 translate-y-[1px] -scale-x-100">
                            <svg viewBox="0 0 85 64" fill="none" className="h-full w-auto">
                                <path d="M50 45C57.3095 56.6952 71.2084 63.9997 85 64V0H0C13.7915 0 26.6905 7.30481 34 19L50 45Z" fill="currentColor"></path>
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="relative bg-neutral-100 pt-12 pb-32 -mt-[1px] z-10 border-b border-gray-300">
                    <div className="pointer-events-none absolute bottom-0 left-1/2 h-3/4 w-[1600px] -translate-x-1/2 opacity-[0.08] blur-[200px] bg-[conic-gradient(from_-81deg,#F00,#EAB308_99deg,#5CFF80_162deg,#00FFF9_216deg,#3A8BFD_288deg,#855AFC)]"></div>

                    <div className="max-w-4xl mx-auto px-6 relative z-10">
                        <div className="rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm">
                            <div className="p-6 md:p-8 min-h-[400px] flex flex-col">
                                <div className="grid w-full grid-cols-2 h-10 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 mb-8 self-center max-w-[400px]">
                                    <button
                                        onClick={() => setActiveTab('pdf')}
                                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all ${activeTab === 'pdf' ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-200/50 hover:text-slate-900'}`}
                                    >
                                        PDF 원천징수부
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('excel')}
                                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-white transition-all ${activeTab === 'excel' ? 'bg-white text-slate-950 shadow-sm' : 'hover:bg-slate-200/50 hover:text-slate-900'}`}
                                    >
                                        통합 엑셀 자료
                                    </button>
                                </div>

                                <div className="flex-1">
                                    {activeTab === 'pdf' ? (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-center w-full">
                                                <label
                                                    htmlFor="pdf-upload"
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={(e) => {
                                                        e.preventDefault();
                                                        if (e.dataTransfer.files) {
                                                            const validFiles = Array.from(e.dataTransfer.files).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
                                                            if (validFiles.length > 0) {
                                                                const newFiles = validFiles.map((file) => {
                                                                    file.uid = Math.random().toString(36).substring(7);
                                                                    return file;
                                                                });
                                                                setFiles((prev) => [...prev, ...newFiles]);
                                                            } else {
                                                                message.error('PDF 파일만 업로드 가능합니다.');
                                                            }
                                                        }
                                                    }}
                                                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                                                >
                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                        <InboxOutlined className="text-4xl text-slate-400 mb-4" />
                                                        <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                    </div>
                                                        <input
                                                            id="pdf-upload"
                                                            name="pdf-upload"
                                                            type="file"
                                                        multiple
                                                        accept=".pdf"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            if (e.target.files) {
                                                                const newFiles = Array.from(e.target.files).map((file) => {
                                                                    file.uid = Math.random().toString(36).substring(7);
                                                                    return file;
                                                                });
                                                                setFiles((prev) => [...prev, ...newFiles]);
                                                                e.target.value = '';
                                                            }
                                                        }}
                                                    />
                                                </label>
                                            </div>

                                            {files.length > 0 && (
                                                <div className="animate-in fade-in zoom-in-95 duration-200 space-y-4 max-w-2xl mx-auto pt-4 border-t border-slate-100">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-sm font-semibold tracking-tight">Selected Files ({files.length})</h4>
                                                        </div>
                                                        <button onClick={handleReset} className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors">
                                                            Clear All
                                                        </button>
                                                    </div>

                                                    <div className="max-h-[200px] overflow-y-auto rounded-md border border-slate-200 p-1">
                                                        {files.map((file, index) => (
                                                            <div key={file.uid || index} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-sm group transition-colors">
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 group-hover:text-red-500 transition-colors">
                                                                        <FilePdfOutlined />
                                                                    </div>
                                                                    <span className="text-sm font-medium truncate max-w-[200px] md:max-w-[300px]">{file.name}</span>
                                                                </div>
                                                                <button onClick={() => removeFile(file)} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                                                    <DeleteOutlined />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {!processedData ? (
                                                        <button
                                                            onClick={handleProcess}
                                                            disabled={isProcessing}
                                                            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors disabled:pointer-events-none disabled:opacity-50 bg-slate-900 text-slate-50 hover:bg-slate-900/90 h-10 px-4 py-2 w-full"
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
                                                                <button onClick={handleReset} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-9 px-3">
                                                                    Reset
                                                                </button>
                                                                <button onClick={handleDownload} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-9 px-3">
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
                                                    <label
                                                        htmlFor="excel-upload"
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                                const file = e.dataTransfer.files[0];
                                                                customRequestExcel({ file, onSuccess: () => {} });
                                                            }
                                                        }}
                                                        className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                                                    >
                                                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                            <FileExcelOutlined className="text-4xl text-emerald-500 mb-4" />
                                                            <p className="text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                        </div>
                                                        <input
                                                            id="excel-upload"
                                                            name="excel-upload"
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
                                                            <button onClick={handleReset} className="btn btn-outline btn-sm px-8">
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

                <div className="relative z-10 w-full h-24 bg-white"></div>

                {loadingSessionId && (
                    <div className="w-full bg-white relative z-10">
                        <div className="max-w-[1200px] mx-auto px-6 pb-6 text-sm text-slate-500">
                            저장된 계산을 불러오는 중입니다...
                        </div>
                    </div>
                )}

                {processedData && processedData.length > 0 && (
                    <div className="w-full bg-white relative z-10 pb-32">
                        <div className="max-w-[1200px] mx-auto px-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            {activeSessionTitle && (
                                <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 shadow-sm">
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        현재 작업 중 세션
                                    </div>
                                    <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                                        {activeSessionTitle}
                                    </div>
                                </div>
                            )}
                            <EmploymentIncreaseCalculator
                                key={`${activeSessionId || 'draft'}-${calculatorRenderKey}`}
                                initialData={processedData}
                                initialSessionState={restoredSessionState}
                                onStateChange={setCalculatorState}
                            />
                        </div>
                    </div>
                )}
            </Content>
            <Footer style={{ textAlign: 'center', color: '#999', background: 'white' }}>
                TAXGO ©2026 Created for Tax Professionals
            </Footer>
        </Layout>
    );
}
