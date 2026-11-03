import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "SkillWhy | 회원 포털", template: "%s | SkillWhy" },
  description: "SkillWhy 선택형 회원 포털. 내 프로필과 계정 요청을 관리합니다.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
