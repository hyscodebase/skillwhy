import { Header, Footer, Notice, PageHeading } from "@/components/shell";
import { AuthForm } from "@/components/auth-form";
import { portalConfig } from "@/lib/config";
export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const query = await searchParams;
  const configured = Boolean(portalConfig());
  return (
    <>
      <Header />
      <main className="auth-layout">
        <section className="auth-aside">
          <p className="eyebrow">A SMALL SPACE FOR YOU</p>
          <h1>
            함께 쓰는 도구,
            <br />
            선택하는 연결.
          </h1>
          <p>
            이메일과 표시 이름만으로 시작하세요.
            <br />
            CLI의 설정과 snapshot은 수집하지 않습니다.
          </p>
          <div className="aside-rule">선택형 계정 / 기본 수집 최소화</div>
        </section>
        <section className="auth-card">
          <PageHeading label="GET STARTED" title="계정 만들기">
            인증 이메일을 확인하면 가입이 완료됩니다.
          </PageHeading>
          <Notice code={!configured ? "unavailable" : query.notice} />
          <AuthForm mode="signup" configured={configured} />
        </section>
      </main>
      <Footer />
    </>
  );
}
