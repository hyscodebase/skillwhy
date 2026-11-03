# SkillWhy optional member portal

이 앱은 로컬 CLI와 별도로 실행하는 선택형 회원 포털입니다. CLI의 로그인,
설정 업로드, snapshot 수집, 사용 추적을 추가하지 않습니다. 루트 npm 패키지의
배포 파일에는 `apps/portal`이 포함되지 않습니다.

## 구현 범위

- 이메일·비밀번호 가입, 이메일 확인, 로그인·로그아웃, 비밀번호 재설정
- 가입 시 최소 권한의 회원 프로필 자동 생성
- 본인 표시 이름 수정, 본인 계정 요청 조회
- 관리자 회원 목록(25명 단위), 활성/정지, 삭제 검토 요청, 변경 기록
- 정지와 세션 폐기를 기존 JWT에도 반영하는 데이터베이스 권한 검사
- 계정 삭제 **검토 요청**. 자동 영구 삭제나 보관기간 만료 삭제는 구현하지 않음

역할은 데이터베이스에 보관합니다. 가입 시 `user_metadata.role`을 보내거나
프로필 요청에 `role`/`status`를 붙여도 관리자 권한을 얻지 못합니다. 첫 관리자는
아래의 운영자 SQL 절차로만 지정합니다. 앱에는 service-role/secret 키가 없습니다.

## 실행

Node.js 22 이상이 필요합니다.

```sh
cd apps/portal
npm ci
cp .env.example .env.local
# .env.local에 전용 Supabase URL·publishable key·포털 origin 입력
npm run dev
```

기본 주소는 `http://localhost:3000`입니다. `PORTAL_SITE_URL`과 같은 origin으로
접속하세요. 다른 포트·`127.0.0.1` 주소를 쓴다면 환경변수도 그 주소로 맞춥니다.
`NEXT_PUBLIC_` 변수에는 publishable key만 넣습니다. `.env.local`은 Git에서 제외됩니다.

## Supabase 준비

1. 새 전용 프로젝트를 준비합니다. 기존 서비스 데이터베이스와 섞지 않습니다.
2. 새 회원이 가입하기 **전에** `supabase/migrations/*_portal_members.sql`을 적용합니다.
   이 마이그레이션은 빈 전용 프로젝트용입니다. 기존 `auth.users`의 프로필을
   자동으로 backfill하지 않습니다. 적용 전 기존 테이블을 확인하세요.
3. Auth 설정에서 Email provider와 회원가입을 활성화하고, 이메일 확인은 켜고,
   anonymous sign-ins는 끕니다. 비밀번호 최소 길이를 **12**로 설정합니다.
   프런트엔드 입력 검사만으로 Auth API 전체의 정책이 강제되지는 않습니다.
4. 외부 회원의 인증·재설정 메일을 위해 **custom SMTP**를 설정합니다. Supabase의
   기본 메일 서비스는 조직 팀원 주소만 허용하므로 외부 가입 완료의 근거가 되지 않습니다.
5. Auth Site URL을 `PORTAL_SITE_URL`로 설정합니다. 개발 중 허용할 redirect URL:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/auth/callback?flow=recovery`
     운영 배포에는 정확한 HTTPS 포털 주소를 사용합니다. 광범위한 wildcard는 사용하지 않습니다.

메일을 다른 기기에서 열어도 작동하게 하려면 Email Templates의 링크를 다음처럼
`token_hash` 확인 경로로 설정합니다. `SiteURL`은 정확한 포털 origin입니다.

가입 확인:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email"
  >이메일 확인</a
>
```

비밀번호 재설정:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
  >비밀번호 재설정</a
>
```

기본 PKCE `/auth/callback`도 구현돼 있습니다. 확인 메일을 최초 가입 요청과 다른
브라우저에서 열면 PKCE verifier cookie가 없을 수 있으므로 위의 token-hash 링크를
권장합니다. 메일 템플릿·SMTP·Auth 설정은 앱 빌드만으로 구성되지 않습니다.

## 첫 관리자 지정

운영자가 본인 계정으로 가입하고 이메일 확인을 완료한 다음, Supabase SQL Editor의
인증된 프로젝트 소유자 권한으로 아래를 실행합니다. 이메일을 실제 운영자 주소로
바꿉니다. 브라우저 입력이나 JWT의 사용자 메타데이터를 관리자 자격으로 사용하지 않습니다.

```sql
update public.member_profiles p
set role = 'admin'
from auth.users u
where p.id = u.id
  and u.email = 'REPLACE_WITH_VERIFIED_OPERATOR_EMAIL'
  and u.email_confirmed_at is not null;
```

영향받은 행이 정확히 하나인지 확인하세요. 앱의 관리 화면에는 역할 부여 기능이
없습니다. 관리자 상태 변경은 자신을 대상으로 할 수 없고, 같은 데이터베이스 잠금으로
직렬화한 뒤 현재 관리자 자격을 다시 확인합니다.

## 데이터와 권한

`member_profiles`는 본인 또는 활성 관리자만 읽을 수 있습니다. 회원이 직접 바꿀 수
있는 열은 `display_name`뿐입니다. 생성 트리거가 역할을 `member`, 상태를 `active`로
초기화하며, 이메일은 Auth 사용자 정보와 동기화됩니다.

RLS guard는 신선한 프로필 역할·상태, JWT의 사용자/세션 식별자,
`auth.sessions` 존재와 `not_after`를 검사합니다. 정지하면 과거 JWT의 프로필/관리
접근도 막힙니다. 정지 회원은 본인 삭제 검토 요청을 남길 수 있습니다. 이는 Supabase
Auth 자체에서 로그인을 차단하거나 모든 세션을 자동 폐기하는 기능은 아닙니다.

`member_audit_events`는 관리자에게만 읽기를 허용합니다. 클라이언트의 직접 삽입·수정·삭제는
허용하지 않습니다. 프로필 생성·이름 수정·앱을 통한 상태 변경·삭제 요청/검토를 기록하며,
응답 본문이나 비밀번호를 복제하지 않습니다. 프로젝트 소유자가 SQL로 직접 한 권한 변경은
별도 운영 절차로 관리해야 합니다.

공개 RPC는 security-invoker wrapper입니다. 필요한 privileged 구현은 노출하지 않는
`private` 스키마에 있고, 고정 `search_path`, 명시적 EXECUTE grant, 호출자 검증을 사용합니다.
`private`를 Data API exposed schemas에 추가하지 마세요.

프로필·관리 화면은 요청별로 조회하며, 인증 응답은 `private, no-store`입니다. 쿠키는
HttpOnly/SameSite=Lax이고 운영 HTTPS origin에서는 Secure입니다. 모든 변경 Server Action은
설정된 origin을 검사하며 세션과 데이터베이스 권한을 다시 확인합니다. 인증 callback은
고정된 같은 origin의 경로만 사용하고 임의 `next` URL을 받지 않습니다.

## 검증

```sh
npm test
npm run typecheck
npm run build
npm run test:database
```

마지막 명령은 Docker와 `postgres:17.11-bookworm` 이미지를 사용합니다. 외부 네트워크와
호스트 포트가 없는 일회용 컨테이너에서 실제 PostgreSQL RLS/RPC를 실행하고 제거합니다.
테스트용 `auth` 테이블·JWT helper는 최소 fixture입니다. 이는 Supabase GoTrue, 실제
이메일 배달, 프로덕션 쿠키·도메인·SMTP까지 검증한 결과가 아닙니다.

검증한 핵심 사례: anon 접근, 다른 회원 조회/수정 차단, 역할·상태·ID 수정 차단,
user metadata 권한 위조 차단, 정지된 기존 JWT, 삭제된/만료 세션, anonymous-auth JWT,
관리자 자기 정지 금지, 중복 삭제 요청, 감사 기록 변경 금지, 실제 삭제가 아닌 검토.

운영 전 실제 허용된 테스트 이메일로 가입 → 인증 → 로그인 → 프로필 수정 → 로그아웃 →
재설정을 확인하고, 일반 회원과 관리자 계정으로 각각 권한을 확인해야 합니다. 자동 테스트는
외부 주소에 메일을 보내거나 실제 회원·관리자 계정을 임의 생성하지 않습니다.

참고: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[비밀번호 재설정](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
