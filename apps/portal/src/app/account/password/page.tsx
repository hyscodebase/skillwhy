import { sessionUser } from "@/lib/member";
import { updatePassword } from "@/app/actions";
import { Header, Footer, PageHeading, Notice } from "@/components/shell";
import { SubmitButton } from "@/components/submit-button";
export const dynamic = "force-dynamic";
export default async function Password({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  await sessionUser();
  const query = await searchParams;
  return (
    <>
      <Header />
      <main className="workspace narrow">
        <section className="panel">
          <PageHeading label="NEW PASSWORD" title="새 비밀번호 설정">
            변경 후에는 새 비밀번호로 다시 로그인합니다.
          </PageHeading>
          <Notice code={query.notice} />
          <form action={updatePassword} className="form-stack">
            <label>
              새 비밀번호
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <label>
              새 비밀번호 확인
              <input
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <SubmitButton>비밀번호 변경</SubmitButton>
          </form>
        </section>
      </main>
      <Footer />
    </>
  );
}
