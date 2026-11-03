import Link from "next/link";
import { sessionUser } from "@/lib/member";
import {
  Header,
  Footer,
  Notice,
  PageHeading,
  dateLabel,
} from "@/components/shell";
export const dynamic = "force-dynamic";
export default async function Requests({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { supabase, user } = await sessionUser();
  const query = await searchParams;
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("id,status,created_at,reviewed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  return (
    <>
      <Header />
      <main className="workspace narrow">
        <PageHeading label="MY REQUESTS" title="계정 요청 내역">
          현재 접수 상태를 확인할 수 있습니다.
        </PageHeading>
        <Notice code={query.notice} />
        <section className="panel">
          {error ? (
            <p role="alert">
              요청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : data?.length ? (
            <ul className="request-list">
              {data.map((row) => (
                <li key={row.id}>
                  <div>
                    <strong>계정 삭제 검토</strong>
                    <p>{dateLabel(row.created_at)} 접수</p>
                  </div>
                  <span
                    className={`badge ${row.status === "pending" ? "warning" : ""}`}
                  >
                    {row.status === "pending" ? "검토 대기" : "검토 완료"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">아직 접수한 요청이 없습니다.</p>
          )}
          <p className="fineprint">
            검토 완료는 실제 데이터 삭제 완료를 의미하지 않습니다. 운영자가 삭제
            절차를 별도로 확인합니다.
          </p>
          <Link href="/account" className="inline-link">
            내 계정으로 →
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
