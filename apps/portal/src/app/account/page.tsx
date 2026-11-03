import Link from "next/link";
import { activeMember } from "@/lib/member";
import {
  Header,
  Footer,
  Notice,
  PageHeading,
  dateLabel,
} from "@/components/shell";
import { SubmitButton } from "@/components/submit-button";
import { DeletionForm } from "@/components/deletion-form";
import { updateProfile } from "@/app/actions";
export const dynamic = "force-dynamic";
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { member } = await activeMember();
  const query = await searchParams;
  return (
    <>
      <Header member={member} />
      <main className="workspace">
        <PageHeading
          label="MY ACCOUNT"
          title={`${member.display_name}님의 공간`}
        >
          프로필과 계정 상태를 확인하고 필요한 요청을 남기세요.
        </PageHeading>
        <Notice code={query.notice} />
        <div className="account-grid">
          <section className="panel">
            <div className="panel-heading">
              <h2>프로필</h2>
              <span className="badge">활성</span>
            </div>
            <form action={updateProfile} className="form-stack">
              <label>
                표시 이름
                <input
                  name="display_name"
                  defaultValue={member.display_name}
                  required
                  minLength={1}
                  maxLength={80}
                />
              </label>
              <label>
                이메일
                <input value={member.email} readOnly type="email" />
                <small>이메일은 인증 계정 정보와 연결됩니다.</small>
              </label>
              <SubmitButton>변경 사항 저장</SubmitButton>
            </form>
          </section>
          <aside className="panel soft">
            <h2>계정 정보</h2>
            <dl className="details">
              <div>
                <dt>권한</dt>
                <dd>{member.role === "admin" ? "관리자" : "일반 회원"}</dd>
              </div>
              <div>
                <dt>가입일</dt>
                <dd>{dateLabel(member.created_at)}</dd>
              </div>
              <div>
                <dt>CLI 로그인</dt>
                <dd>필요 없음</dd>
              </div>
            </dl>
            <Link href="/account/requests" className="inline-link">
              내 요청 내역 보기 →
            </Link>
            <p className="fineprint">
              포털 프로필은 다른 일반 회원에게 공개되지 않습니다.
            </p>
          </aside>
        </div>
        <section className="panel spaced">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ACCOUNT REQUEST</p>
              <h2>계정 삭제 검토</h2>
            </div>
          </div>
          <p className="muted">
            운영자가 요청과 삭제 범위를 확인합니다. 검토 완료 표시와 실제 계정
            삭제는 별개입니다.
          </p>
          <DeletionForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
