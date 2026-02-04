import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider, App } from 'antd';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "TAXGO",
  description: "세무 경정청구 자동계산 프로그램",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" data-theme="light">
      <head>
        <link rel="stylesheet" as="style" crossOrigin="true" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-[Pretendard]`}
      >
        <AntdRegistry>
            <ConfigProvider
                theme={{
                    token: {
                        colorPrimary: '#000000',
                        colorSuccess: '#10B981', // Emerald 500
                        colorWarning: '#F59E0B', // Amber 500
                        colorError: '#EF4444', // Red 500
                        colorInfo: '#000000',
                        fontFamily: "var(--font-geist-sans), Pretendard, sans-serif",
                        borderRadius: 6,
                        wireframe: false,
                    }
                }}
            >
                <App>
                    {children}
                </App>
            </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
