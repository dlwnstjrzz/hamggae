'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { App, Button, Card, Layout, List, Popconfirm, Spin, Typography } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { supabase } from '@/utils/supabase';
import {
    deleteCalculationSession,
    duplicateCalculationSession,
    getCalculationSessionErrorMessage,
    listCalculationSessions,
    renameCalculationSession,
} from '@/utils/calculationSessions';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

export default function MyPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sessions, setSessions] = useState([]);
    const [sessionsLoading, setSessionsLoading] = useState(false);
    const [sessionActionKey, setSessionActionKey] = useState(null);

    useEffect(() => {
        let mounted = true;

        const syncSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!mounted) return;
            setUser(session?.user ?? null);
            setLoading(false);
        };

        syncSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!user) {
            setSessions([]);
            return;
        }

        fetchSessions();
    }, [user]);

    useEffect(() => {
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [loading, router, user]);

    const fetchSessions = async () => {
        setSessionsLoading(true);
        const { data, error } = await listCalculationSessions();

        if (error) {
            console.error(error);
            message.error(getCalculationSessionErrorMessage(error, '저장 목록을 불러오지 못했습니다.'));
        } else {
            setSessions(data || []);
        }

        setSessionsLoading(false);
    };

    const handleSignOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error(error);
            message.error('로그아웃에 실패했습니다.');
            return;
        }

        setSessions([]);
        message.success('로그아웃되었습니다.');
    };

    const handleDelete = async (sessionId) => {
        const { error } = await deleteCalculationSession(sessionId);

        if (error) {
            console.error(error);
            message.error(getCalculationSessionErrorMessage(error, '저장된 계산 삭제에 실패했습니다.'));
            return;
        }

        await fetchSessions();
        message.success('저장된 계산을 삭제했습니다.');
    };

    const handleRename = async (session) => {
        const inputTitle = window.prompt('변경할 제목을 입력해주세요.', session.title);
        if (inputTitle === null) return;

        const title = inputTitle.trim();
        if (!title) {
            message.warning('제목을 비워둘 수 없습니다.');
            return;
        }

        setSessionActionKey(`rename-${session.id}`);
        const { error } = await renameCalculationSession(session.id, title);

        if (error) {
            console.error(error);
            message.error(getCalculationSessionErrorMessage(error, '제목 변경에 실패했습니다.'));
        } else {
            await fetchSessions();
            message.success('제목을 변경했습니다.');
        }
        setSessionActionKey(null);
    };

    const handleDuplicate = async (session) => {
        if (!user) {
            message.warning('로그인 후 이용해주세요.');
            return;
        }

        const defaultTitle = `${session.title} 복사본`;
        const inputTitle = window.prompt('복사본 제목을 입력해주세요.', defaultTitle);
        if (inputTitle === null) return;

        const title = inputTitle.trim() || defaultTitle;
        setSessionActionKey(`duplicate-${session.id}`);

        const { error } = await duplicateCalculationSession({
            userId: user.id,
            title,
            sourceData: session.source_data || [],
            calculatorState: session.calculator_state || {},
        });

        if (error) {
            console.error(error);
            message.error(getCalculationSessionErrorMessage(error, '계산 복제에 실패했습니다.'));
        } else {
            await fetchSessions();
            message.success('저장된 계산을 복제했습니다.');
        }
        setSessionActionKey(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Spin />
            </div>
        );
    }

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

                    <Link href="/" className="flex items-center cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="relative w-24 h-12">
                            <Image src="/logo2.png" alt="TAXGO Logo" fill style={{ objectFit: 'contain' }} priority />
                        </div>
                    </Link>

                    <div className="flex-1 flex justify-end">
                        <div className="flex items-center gap-2 pointer-events-auto">
                            <Link href="/">
                                <Button type="default" className="h-9 px-4 rounded-md">
                                    메인으로
                                </Button>
                            </Link>
                            <Button
                                type="primary"
                                className="bg-black hover:bg-slate-800 text-white font-medium h-9 px-4 rounded-md shadow-sm border-0"
                                icon={<LogoutOutlined />}
                                onClick={handleSignOut}
                            >
                                로그아웃
                            </Button>
                        </div>
                    </div>
                </div>
            </Header>

            <Content style={{ width: '100%', flex: 1, position: 'relative', zIndex: 1 }}>
                <div className="max-w-[1200px] mx-auto px-6 pt-[20px] pb-36">
                    <div className="mx-auto max-w-2xl text-center pt-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 mb-6 shadow-sm">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-black mr-2 animate-pulse"></span>
                            My Page
                        </div>
                        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl mb-4" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                            저장한 계산을 <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-500">다시 불러오세요.</span>
                        </h1>
                        <p className="text-sm text-slate-500">{user?.email}</p>
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
                                <div className="flex items-center gap-2.5 text-slate-800">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white bg-[#00D3BB]/10 text-[#00D3BB] shadow-[0_2px_10px_-2px_rgba(0,211,187,0.3)]">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 7 9 18l-5-5" />
                                        </svg>
                                    </div>
                                    <span className="text-[13px] font-semibold tracking-wide uppercase">Saved Sessions</span>
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
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900">저장한 계산 목록</h3>
                                        <p className="text-sm text-slate-500 mt-1">불러오기 또는 삭제할 계산을 선택하세요.</p>
                                    </div>
                                    <Link href="/">
                                        <Button type="default">새 계산하러 가기</Button>
                                    </Link>
                                </div>

                                {sessionsLoading ? (
                                    <div className="flex-1 flex items-center justify-center">
                                        <Spin />
                                    </div>
                                ) : (
                                    <List
                                        locale={{ emptyText: '저장된 계산이 없습니다.' }}
                                        dataSource={sessions}
                                        renderItem={(session) => (
                                            <List.Item
                                                className="!px-4 !py-5 rounded-lg hover:bg-slate-50 transition-colors"
                                                actions={[
                                                    <Link key="load" href={`/?session=${session.id}`}>
                                                        불러오기
                                                    </Link>,
                                                    <Button
                                                        key="rename"
                                                        type="link"
                                                        className="!px-0"
                                                        loading={sessionActionKey === `rename-${session.id}`}
                                                        onClick={() => handleRename(session)}
                                                    >
                                                        제목 변경
                                                    </Button>,
                                                    <Button
                                                        key="duplicate"
                                                        type="link"
                                                        className="!px-0"
                                                        loading={sessionActionKey === `duplicate-${session.id}`}
                                                        onClick={() => handleDuplicate(session)}
                                                    >
                                                        복제
                                                    </Button>,
                                                    <Popconfirm
                                                        key="delete"
                                                        title="이 계산을 삭제할까요?"
                                                        okText="삭제"
                                                        cancelText="취소"
                                                        onConfirm={() => handleDelete(session.id)}
                                                    >
                                                        <Button type="link" danger>
                                                            삭제
                                                        </Button>
                                                    </Popconfirm>,
                                                ]}
                                            >
                                                <List.Item.Meta
                                                    title={<span className="font-semibold text-slate-900">{session.title}</span>}
                                                    description={`수정 ${new Date(session.updated_at).toLocaleString('ko-KR')}`}
                                                />
                                            </List.Item>
                                        )}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Content>

            <Footer style={{ textAlign: 'center', color: '#999', background: 'white' }}>
                TAXGO ©2026 Created for Tax Professionals
            </Footer>
        </Layout>
    );
}
