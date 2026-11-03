import Link from "next/link";
import { Header, Footer } from "@/components/shell";
export default function Home() {
  return (
    <>
      <Header />
      <main className="landing">
        <section className="hero">
          <div>
            <p className="eyebrow">YOUR SPACE, CLEARLY DEFINED</p>
            <h1>
              개발 환경을 이해하는 도구,
              <br />
              <em>함께 가꾸는 공간.</em>
            </h1>
            <p className="hero-copy">
              SkillWhy의 선택형 회원 포털입니다.
              <br />
              프로필과 계정 요청을 한곳에서 관리하세요.
            </p>
            <div className="actions">
              <Link href="/signup" className="button">
                계정 만들기 <span>↗</span>
              </Link>
              <Link href="/login" className="button secondary">
                로그인
              </Link>
            </div>
            <p className="fineprint">
              CLI 실행에는 회원 가입이나 로그인이 필요하지 않습니다.
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-top">
              SKILLWHY / YOUR ACCOUNT <span>●</span>
            </div>
            <div className="art-profile">
              <div className="avatar">sw</div>
              <div>
                <strong>나에게 맞는 작은 공간</strong>
                <p>프로필 · 계정 상태 · 요청 내역</p>
              </div>
            </div>
            <div className="art-row">
              <span>명확한 내 계정</span>
              <b>01</b>
            </div>
            <div className="art-row">
              <span>필요한 정보만</span>
              <b>02</b>
            </div>
            <div className="art-row">
              <span>선택할 수 있는 참여</span>
              <b>03</b>
            </div>
            <div className="art-note">LOCAL CLI. OPTIONAL PORTAL.</div>
          </div>
        </section>
        <section className="feature-grid" aria-label="포털 기능">
          <article>
            <span className="feature-number">01 / PROFILE</span>
            <h2>내 프로필</h2>
            <p>표시 이름과 계정 상태를 확인하고 프로필을 직접 수정합니다.</p>
          </article>
          <article>
            <span className="feature-number">02 / CONTROL</span>
            <h2>계정 요청</h2>
            <p>삭제 검토를 요청하고 진행 상태를 확인할 수 있습니다.</p>
          </article>
          <article>
            <span className="feature-number">03 / ADMIN</span>
            <h2>운영자 관리</h2>
            <p>관리자는 회원 상태와 계정 요청, 변경 기록을 함께 확인합니다.</p>
          </article>
        </section>
      </main>
      <Footer />
    </>
  );
}
