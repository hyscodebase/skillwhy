import Link from "next/link";
import { login, signup } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
export function AuthForm({
  mode,
  configured,
}: {
  mode: "login" | "signup";
  configured: boolean;
}) {
  const registering = mode === "signup";
  return (
    <form action={registering ? signup : login} className="form-stack">
      <fieldset disabled={!configured}>
        {registering ? (
          <label>
            표시 이름
            <input
              name="display_name"
              autoComplete="nickname"
              minLength={1}
              maxLength={80}
              required
              placeholder="다른 회원에게 공개되지 않는 표시 이름"
            />
          </label>
        ) : null}
        <label>
          이메일
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            name="password"
            autoComplete={registering ? "new-password" : "current-password"}
            minLength={registering ? 12 : 1}
            maxLength={128}
            required
          />
          {registering ? <small>12~128자로 입력해 주세요.</small> : null}
        </label>
        {registering ? (
          <label className="check">
            <input type="checkbox" name="privacy" required />
            <span>
              <Link href="/privacy">계정 개인정보 안내</Link>를 확인했습니다.
              포털 가입은 선택 사항입니다.
            </span>
          </label>
        ) : null}
        <SubmitButton>{registering ? "계정 만들기" : "로그인"}</SubmitButton>
      </fieldset>
      {!registering ? (
        <p className="form-switch">
          <Link href="/forgot-password">비밀번호를 잊으셨나요?</Link>
        </p>
      ) : null}
      <p className="form-switch">
        {registering ? "이미 계정이 있나요?" : "처음 방문하셨나요?"}{" "}
        <Link href={registering ? "/login" : "/signup"}>
          {registering ? "로그인" : "계정 만들기"}
        </Link>
      </p>
    </form>
  );
}
