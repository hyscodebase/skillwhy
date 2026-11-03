import { Header, Footer, Notice, PageHeading } from "@/components/shell";
import { AuthForm } from "@/components/auth-form";
import { portalConfig } from "@/lib/config";
export default async function Login({
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
          <p className="eyebrow">WELCOME BACK</p>
          <h1>
            계속해서,
            <br />
            명확하게.
          </h1>
          <p>
            내 프로필과 계정 요청을 확인하세요.
            <br />
            로컬 CLI는 언제나 계정 없이 사용할 수 있습니다.
          </p>
          <div className="aside-rule">SkillWhy / 회원 포털</div>
        </section>
        <section className="auth-card">
          <PageHeading label="MEMBER ACCESS" title="로그인">
            가입한 이메일로 로그인해 주세요.
          </PageHeading>
          <Notice code={!configured ? "unavailable" : query.notice} />
          <AuthForm mode="login" configured={configured} />
        </section>
      </main>
      <Footer />
    </>
  );
}
