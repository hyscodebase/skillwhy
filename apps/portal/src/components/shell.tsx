import Link from "next/link";
import { logout } from "@/app/actions";
import type { Member } from "@/lib/member";

export function Header({ member }: { member?: Member }) {
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-mark">sw</span>
        <span>
          SkillWhy <small>MEMBER PORTAL</small>
        </span>
      </Link>
      <nav aria-label="주 메뉴">
        <a href="https://github.com/hyscodebase/skillwhy">GitHub ↗</a>
        {member ? (
          <>
            <Link href="/account">내 계정</Link>
            {member.role === "admin" ? (
              <Link href="/admin">회원 관리</Link>
            ) : null}
            <form action={logout}>
              <button className="text-button">로그아웃</button>
            </form>
          </>
        ) : (
          <Link className="button small" href="/login">
            로그인
          </Link>
        )}
      </nav>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <span>SkillWhy · 함께 더 명확한 개발 환경을 만듭니다.</span>
      <Link href="/privacy">계정 개인정보 안내</Link>
      <span>CLI는 계정 없이 사용할 수 있습니다.</span>
    </footer>
  );
}
export function PageHeading({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{label}</p>
      <h1>{title}</h1>
      {children ? <p className="subtitle">{children}</p> : null}
    </div>
  );
}
const notices: Record<string, string> = {
  credentials:
    "이메일 또는 비밀번호를 확인해 주세요. 이메일 인증이 아직 끝나지 않았을 수도 있습니다.",
  "check-email":
    "인증 메일을 확인해 주세요. 링크를 열면 가입을 마칠 수 있습니다.",
  signup:
    "가입 요청을 완료하지 못했습니다. 잠시 후 다시 시도하거나 기존 계정으로 로그인해 주세요.",
  invalid: "이름, 12~128자 비밀번호, 개인정보 안내 확인을 다시 확인해 주세요.",
  unavailable:
    "현재 계정 연결을 준비하고 있습니다. 잠시 후 다시 시도해 주세요.",
  "signed-out": "로그아웃했습니다.",
  saved: "프로필을 저장했습니다.",
  forbidden: "관리자에게만 허용된 페이지입니다.",
  "signout-error":
    "로그아웃을 완료하지 못했습니다. 연결을 확인하고 내 계정에서 다시 시도해 주세요.",
  "reset-error": "재설정 안내를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.",
  "reset-sent":
    "등록된 이메일이라면 비밀번호 재설정 안내를 받을 수 있습니다. 메일함을 확인해 주세요.",
  "invalid-password":
    "비밀번호를 12~128자로 입력하고 두 입력 값이 같은지 확인해 주세요.",
  "password-error":
    "비밀번호를 변경하지 못했습니다. 인증 링크를 다시 요청하거나 잠시 후 시도해 주세요.",
  "password-updated": "비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.",
  "password-updated-session-error":
    "비밀번호를 변경했지만 로그아웃을 완료하지 못했습니다. 내 계정에서 로그아웃을 다시 시도해 주세요.",
  "invalid-name": "표시 이름을 1~80자로 입력해 주세요.",
  "save-error": "프로필을 저장하지 못했습니다. 다시 시도해 주세요.",
  "invalid-status": "요청한 상태 변경을 진행할 수 없습니다.",
  "change-error":
    "회원 상태를 변경하지 못했습니다. 권한과 현재 상태를 확인해 주세요.",
  updated: "회원 상태를 변경했습니다.",
  "confirm-request": "삭제 검토 요청 확인란을 선택해 주세요.",
  "invalid-reason": "요청 내용은 500자 이내로 적어 주세요.",
  "request-error": "요청을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  requested: "삭제 검토 요청을 접수했습니다. 아직 계정이 삭제된 것은 아닙니다.",
  "review-error": "검토 상태를 저장하지 못했습니다.",
  reviewed:
    "요청을 검토 완료로 표시했습니다. 실제 계정 삭제는 별도 절차입니다.",
  "confirmation-error":
    "인증 링크를 확인할 수 없습니다. 만료된 링크라면 가입 화면에서 다시 요청해 주세요.",
};
export function Notice({ code }: { code?: string }) {
  const message = code ? notices[code] : null;
  return message ? (
    <div className="notice" role="status">
      {message}
    </div>
  ) : null;
}
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
