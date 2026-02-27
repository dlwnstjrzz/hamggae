'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { Button, Input, List, Typography, message, App, Spin, Card } from 'antd';
import { DownloadOutlined, DeleteOutlined, FilePdfOutlined, LockOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

// Base64 이름 복원기
function decodeOriginalName(encodedName) {
    try {
        let base64 = encodedName.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) { base64 += '='; }
        return decodeURIComponent(atob(base64));
    } catch (e) {
        return encodedName; // 인코딩된 형식이 아니면 (혹은 오류 나면) 원본 그대로 표시
    }
}

export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // 비밀번호 확인
    const handleLogin = () => {
        if (password === 'admin1234') {
            setIsAuthenticated(true);
            fetchFiles();
        } else {
            message.error('비밀번호가 틀렸습니다.');
        }
    };

    const fetchFiles = async () => {
        setLoading(true);
        // Supabase에서 파일 목록 가져오기
        const { data, error } = await supabase.storage.from('hamggae-file').list();

        if (error) {
            console.error(error);
            message.error('파일 목록을 불러오는 중 권한 에러가 발생했습니다. (SELECT Policy를 확인해주세요!)');
        } else {
            // 빈 폴더 placeholder 제거
            const actualFiles = data.filter(file => file.name !== '.emptyFolderPlaceholder');
            
            // 파일명 복원하여 매핑
            const formattedFiles = actualFiles.map(file => {
                // 저장된 이름 형식: [타임스탬프]_[Base64].pdf
                // 예: 1772175000000_JUV.....pdf
                let originalName = file.name;
                
                try {
                    if (file.name.includes('_') && file.name.endsWith('.pdf')) {
                        const base64Part = file.name.substring(file.name.indexOf('_') + 1, file.name.lastIndexOf('.pdf'));
                        const decoded = decodeOriginalName(base64Part);
                        if (decoded !== base64Part) {
                            originalName = decoded;
                        }
                    }
                } catch (e) {
                    // 복원 실패 시 그대로
                }

                return {
                    id: file.id,
                    storageName: file.name,
                    displayName: originalName,
                    created_at: file.created_at,
                    size: file.metadata?.size || 0
                };
            });
            
            // 최신순 정렬
            formattedFiles.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setFiles(formattedFiles);
        }
        setLoading(false);
    };

    const handleDownload = async (file) => {
        const hide = message.loading('다운로드 중...', 0);
        try {
            const { data, error } = await supabase.storage.from('hamggae-file').download(file.storageName);
            if (error) throw error;

            const url = window.URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.displayName || file.storageName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            hide();
            message.success('다운로드 완료');
        } catch (error) {
            console.error('Download error:', error);
            hide();
            message.error('다운로드에 실패했습니다. (SELECT 권한을 확인해주세요)');
        }
    };

    const handleDelete = async (file) => {
        if (!confirm(`정말로 삭제하시겠습니까?\n${file.displayName}`)) return;
        
        try {
            const { error } = await supabase.storage.from('hamggae-file').remove([file.storageName]);
            if (error) throw error;
            
            message.success('파일이 삭제되었습니다.');
            setFiles(files.filter(f => f.storageName !== file.storageName));
        } catch (error) {
            console.error('Delete error:', error);
            message.error('삭제 권한이 없습니다. (DELETE Policy 필요)');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Card className="w-96 shadow-lg border-0">
                    <div className="text-center mb-6">
                        <LockOutlined className="text-4xl text-slate-400 mb-2" />
                        <Title level={4}>Admin Login</Title>
                        <Text type="secondary">임시 관리자 페이지</Text>
                    </div>
                    <div className="flex flex-col gap-3">
                        <Input.Password 
                            placeholder="비밀번호" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onPressEnter={handleLogin}
                            size="large"
                        />
                        <Button type="primary" className="bg-slate-900" size="large" onClick={handleLogin}>
                            로그인
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <Title level={3} className="!mb-0">임시 파일 관리자</Title>
                    <Text type="secondary">Supabase ('hamggae-file' 버킷) 연동 저장소</Text>
                </div>
                <Button onClick={fetchFiles} disabled={loading}>
                    새로고침
                </Button>
            </div>

            <Card className="shadow-sm">
                <List
                    loading={loading}
                    itemLayout="horizontal"
                    dataSource={files}
                    locale={{ emptyText: '업로드된 파일이 없습니다.' }}
                    renderItem={(file) => (
                        <List.Item
                            actions={[
                                <Button 
                                    type="primary" 
                                    icon={<DownloadOutlined />} 
                                    size="small" 
                                    onClick={() => handleDownload(file)}
                                >
                                    다운로드
                                </Button>,
                                <Button 
                                    danger 
                                    icon={<DeleteOutlined />} 
                                    size="small"
                                    onClick={() => handleDelete(file)}
                                >
                                    삭제
                                </Button>
                            ]}
                        >
                            <List.Item.Meta
                                avatar={<FilePdfOutlined className="text-2xl text-red-500" />}
                                title={<span className="font-semibold">{file.displayName}</span>}
                                description={
                                    <div className="text-xs text-slate-400">
                                        업로드: {new Date(file.created_at).toLocaleString('ko-KR')} 
                                        <span className="mx-2">|</span>
                                        실제 저장명: {file.storageName}
                                    </div>
                                }
                            />
                        </List.Item>
                    )}
                />
            </Card>
        </div>
    );
}
