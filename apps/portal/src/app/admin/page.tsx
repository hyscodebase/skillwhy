import Link from "next/link";
import { activeMember, type Member } from "@/lib/member";
import {
  Header,
  Footer,
  Notice,
  PageHeading,
  dateLabel,
} from "@/components/shell";
import { changeStatus, reviewDeletion } from "@/app/actions";
export const dynamic = "force-dynamic";
const actionNames: Record<string, string> = {
  member_created: "회원 프로필 생성",
  profile_updated: "프로필 변경",
  member_activated: "회원 활성화",
  member_suspended: "회원 정지",
  deletion_requested: "삭제 검토 요청",
  deletion_reviewed: "삭제 요청 검토",
};
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; page?: string }>;
}) {
  const { supabase, member } = await activeMember(true);
  const query = await searchParams;
  const page = Math.max(
    1,
    Math.min(1000, Number.parseInt(query.page ?? "1", 10) || 1),
  );
  const [members, requests, audit] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * 25, page * 25 - 1),
    supabase
      .from("account_deletion_requests")
      .select("id,user_id,reason,status,created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("member_audit_events")
      .select("id,actor_id,target_id,action,created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const rows = (members.data ?? []) as Member[];
  return (
    <>
      <Header member={member} />
      <main className="workspace">
        <PageHeading label="ADMINISTRATION" title="회원 관리">
          회원 상태, 삭제 검토 요청과 최근 변경 기록을 확인합니다.
        </PageHeading>
        <Notice code={query.notice} />
        <div className="metric-grid">
          <section>
            <span>전체 회원</span>
            <strong>
              {members.error ? "확인 불가" : (members.count ?? 0)}
            </strong>
          </section>
          <section>
            <span>표시 중인 회원</span>
            <strong>{members.error ? "확인 불가" : rows.length}</strong>
          </section>
          <section>
            <span>삭제 검토 대기</span>
            <strong>
              {requests.error
                ? "확인 불가"
                : `${requests.data?.length ?? 0}${requests.data?.length === 100 ? "+" : ""}`}
            </strong>
          </section>
        </div>
        <section className="panel">
          <div className="panel-heading">
            <h2>회원 목록</h2>
            <span className="muted">페이지당 25명</span>
          </div>
          {members.error ? (
            <p role="alert">회원 목록을 불러오지 못했습니다.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>회원</th>
                    <th>권한</th>
                    <th>상태</th>
                    <th>가입일</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.display_name}</strong>
                        <small className="block">{row.email}</small>
                      </td>
                      <td>{row.role === "admin" ? "관리자" : "회원"}</td>
                      <td>
                        <span
                          className={`badge ${row.status === "suspended" ? "warning" : ""}`}
                        >
                          {row.status === "active" ? "활성" : "정지"}
                        </span>
                      </td>
                      <td>{dateLabel(row.created_at)}</td>
                      <td>
                        {row.id === member.id ? (
                          <span className="muted">내 계정</span>
                        ) : (
                          <form action={changeStatus}>
                            <input
                              type="hidden"
                              name="target_user"
                              value={row.id}
                            />
                            <input
                              type="hidden"
                              name="desired_status"
                              value={
                                row.status === "active" ? "suspended" : "active"
                              }
                            />
                            <button className="table-button">
                              {row.status === "active" ? "정지" : "활성화"}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length ? (
                <p className="empty">이 페이지에 표시할 회원이 없습니다.</p>
              ) : null}
            </div>
          )}
          <div className="pagination">
            {page > 1 ? (
              <Link href={`/admin?page=${page - 1}`}>← 이전</Link>
            ) : (
              <span />
            )}
            <span>{page} 페이지</span>
            {(members.count ?? 0) > page * 25 ? (
              <Link href={`/admin?page=${page + 1}`}>다음 →</Link>
            ) : (
              <span />
            )}
          </div>
        </section>
        <div className="admin-grid">
          <section className="panel">
            <h2>삭제 검토 요청</h2>
            <p className="fineprint">
              검토 완료는 삭제 실행이 아닙니다. 본인·범위·세션 폐기를 확인한 뒤
              별도 절차로 처리하세요.
            </p>
            {requests.error ? (
              <p role="alert">요청을 불러오지 못했습니다.</p>
            ) : requests.data?.length ? (
              <ul className="request-list">
                {requests.data.map((row) => (
                  <li key={row.id}>
                    <div>
                      <strong>{row.user_id.slice(0, 8)}…</strong>
                      <p className="break-text">
                        {row.reason || "추가 내용 없음"}
                      </p>
                      <small>{dateLabel(row.created_at)}</small>
                    </div>
                    <form action={reviewDeletion}>
                      <input type="hidden" name="request_id" value={row.id} />
                      <button className="table-button">검토 완료</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">대기 중인 요청이 없습니다.</p>
            )}
          </section>
          <section className="panel">
            <h2>최근 변경 기록</h2>
            {audit.error ? (
              <p role="alert">변경 기록을 불러오지 못했습니다.</p>
            ) : audit.data?.length ? (
              <ul className="audit-list">
                {audit.data.map((event) => (
                  <li key={event.id}>
                    <span className="audit-dot" />
                    <div>
                      <strong>
                        {actionNames[event.action] ?? "계정 변경"}
                      </strong>
                      <p>
                        {event.target_id?.slice(0, 8) ?? "삭제된 계정"}… ·{" "}
                        {dateLabel(event.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">변경 기록이 없습니다.</p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
