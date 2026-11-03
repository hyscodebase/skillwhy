"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="workspace narrow">
      <section className="panel">
        <p className="eyebrow">잠시 확인이 필요합니다</p>
        <h1>요청을 마치지 못했습니다.</h1>
        <p>
          계정 정보를 확인하거나 잠시 후 다시 시도해 주세요. 입력한 비밀번호와
          인증 값은 오류 화면에 표시하지 않습니다.
        </p>
        <button onClick={reset} className="button">
          다시 시도
        </button>
        <a href="/" className="inline-link">
          처음으로
        </a>
      </section>
    </main>
  );
}
