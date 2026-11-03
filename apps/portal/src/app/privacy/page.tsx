import { Header, Footer, PageHeading } from "@/components/shell";
export default function Privacy() {
  return (
    <>
      <Header />
      <main className="workspace narrow">
        <PageHeading label="ACCOUNT PRIVACY" title="계정 개인정보 안내">
          선택형 회원 포털에 적용되는 안내입니다.
        </PageHeading>
        <article className="panel prose">
          <h2>저장하는 정보</h2>
          <p>
            이메일, 표시 이름, 계정 식별자, 회원 권한·상태, 생성·변경 시각, 삭제
            검토 요청과 최소한의 변경 기록을 저장합니다. 비밀번호는 Supabase
            Auth가 처리하며 포털 프로필에 저장하지 않습니다.
          </p>
          <h2>사용 목적과 접근</h2>
          <p>
            로그인, 본인 프로필 수정, 계정 상태 관리, 삭제 검토 처리에
            사용합니다. 일반 회원은 자신의 프로필과 요청만 볼 수 있고, 관리자는
            회원 목록·요청·변경 기록을 확인할 수 있습니다. 인증·데이터베이스
            제공자는 Supabase입니다.
          </p>
          <h2>로컬 CLI와의 관계</h2>
          <p>
            CLI는 계정 없이 사용할 수 있습니다. 포털은 CLI의 설정, snapshot,
            Skill 본문, 로컬 실행 기록을 수집하지 않습니다. 인터뷰·파일럿 신청
            폼은 별도의 자발적 제출 경로입니다.
          </p>
          <h2>수정과 삭제 요청</h2>
          <p>
            표시 이름은 내 계정에서 수정할 수 있습니다. 삭제는 내 계정의 검토
            요청으로 접수합니다. 운영자가 본인과 삭제 범위·보관 필요 여부를
            확인한 뒤 처리하며, 접수·검토 완료 표시는 실제 삭제 완료를 의미하지
            않습니다.
          </p>
          <h2>연락 및 운영</h2>
          <p>
            이메일은 인증과 계정 운영에 사용합니다. 홍보 메일이나 자동 인터뷰
            초대에 가입시키지 않습니다. 자료는 운영 목적에 필요한 범위에서
            관리하며, 이 초기 버전에는 자동 보관기간 만료 삭제가 없습니다.
          </p>
          <p className="fineprint">SkillWhy 유지관리자 · 2026-11-03</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
