import Link from "next/link";
import { sendPasswordReset } from "@/app/actions";
import { Header, Footer, PageHeading, Notice } from "@/components/shell";
import { SubmitButton } from "@/components/submit-button";
import { portalConfig } from "@/lib/config";
export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const query = await searchParams;
  const configured = Boolean(portalConfig());
  return (
    <>
      <Header />
      <main className="workspace narrow">
        <section className="panel">
          <PageHeading label="ACCOUNT RECOVERY" title="비밀번호 재설정">
            가입한 이메일로 재설정 안내를 요청합니다.
          </PageHeading>
          <Notice code={!configured ? "unavailable" : query.notice} />
          <form action={sendPasswordReset} className="form-stack">
            <fieldset disabled={!configured}>
              <label>
                이메일
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
              <SubmitButton>재설정 안내 요청</SubmitButton>
            </fieldset>
          </form>
          <Link href="/login" className="inline-link">
            로그인으로 →
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
