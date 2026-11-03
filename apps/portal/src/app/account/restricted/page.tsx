import { sessionUser } from "@/lib/member";
import { Header, Footer, PageHeading } from "@/components/shell";
import { DeletionForm } from "@/components/deletion-form";
import { logout } from "@/app/actions";
export const dynamic = "force-dynamic";
export default async function Restricted() {
  await sessionUser();
  return (
    <>
      <Header />
      <main className="workspace narrow">
        <PageHeading label="ACCOUNT STATUS" title="계정 접근을 확인해 주세요">
          계정이 정지되었거나 회원 프로필을 확인할 수 없습니다.
        </PageHeading>
        <section className="panel">
          <p>
            계정 상태는 운영자 확인이 필요합니다. 삭제 검토 요청은 이 화면에서도
            접수할 수 있습니다.
          </p>
          <DeletionForm />
          <form action={logout} className="spaced">
            <button className="text-button">로그아웃</button>
          </form>
        </section>
      </main>
      <Footer />
    </>
  );
}
