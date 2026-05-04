'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { App, Button } from 'antd';
import { supabase } from '@/utils/supabase';

export default function LoginPage() {
    const { message } = App.useApp();
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const syncSession = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!mounted) return;

            if (session?.user) {
                router.replace('/');
                return;
            }

            setLoading(false);
        };

        syncSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                router.replace('/');
                return;
            }

            setLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [router]);

    const handleGoogleSignIn = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/login`,
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

    if (loading) return null;

    return (
        <div className="fixed inset-0 overflow-hidden bg-white">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:60px_60px]"></div>
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="max-w-[1200px] mx-auto h-full border-x border-gray-300/80"></div>
            </div>

            <div className="relative z-10 flex h-full w-full items-center justify-center px-6">
                <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
                    <div className="mb-8 text-center">
                        <div className="relative mx-auto mb-5 h-14 w-28">
                            <Image src="/logo2.png" alt="TAXGO Logo" fill style={{ objectFit: 'contain' }} priority />
                        </div>
                        <h1 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">Google Login</h1>
                        <p className="text-sm text-slate-500">
                            저장한 계산 결과를 불러오고 계정별로 계속 관리하려면 로그인하세요.
                        </p>
                    </div>

                    <Button
                        type="primary"
                        block
                        size="large"
                        className="h-12 bg-slate-900 hover:bg-slate-800 shadow-md"
                        onClick={handleGoogleSignIn}
                    >
                        Google로 로그인
                    </Button>
                </div>
            </div>
        </div>
    );
}
