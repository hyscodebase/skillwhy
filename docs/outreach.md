# 초대와 공개 소개 초안 — 발송·게시하지 않음

확인일: **2026-11-02 UTC**. 초대 발송 0건, 게시 0건, 응답 0건,
완료한 외부 파일럿 0건이다. 이 문서는 향후 직접 검토해 사용할 자료이며,
작성만으로 연락·게시 권한이나 상대의 동의가 생기지 않는다.

[후보 5곳](research/pilot-candidates.md), [인터뷰와 판정 기준](interviews.md),
[실행 가이드](pilot.md)를 연결한다. 아래 명령은 이미 배포된 GitHub 태그를
사용한다. npm 레지스트리 게시나 추가 플랫폼 지원을 먼저 달성했다고 쓰지 않는다.

## 개별 초대문

공개적으로 피드백을 환영하는 경로가 확인되거나 상대가 참여 의사를 밝혔을 때,
대괄호 부분을 해당 근거에 맞게 바꾼다. 허용된 연락 경로는 아직 확인되지 않았다.
프로젝트의 버그 이슈·닫힌 이슈를 초대 게시판으로 사용하지 않는다. 무응답 시
자동 재전송하지 않고, 거절하면 종료한다. 공개 커밋에서 이메일을 추출하지 않는다.

### 한국어

> 안녕하세요. SkillWhy를 만드는 홍유석입니다. [프로젝트의 문서/이슈 링크]에서 [직접 확인한 discovery 관련 내용]을 읽었습니다. 저는 fresh Codex CLI가 반환하는 skill 정보를 비교하고, 선택한 한 항목의 최소 진단 파일을 만드는 작은 OSS를 개발하고 있습니다. 이 방식이 실제 지원 과정에 필요한지 10분 정도 의견을 듣고 싶습니다. 현재 live capture는 Codex CLI 0.166.0 / macOS arm64·Linux x64를 지원하며(Linux 검증은 Ubuntu 24.04), 다른 환경에서는 API 키 없이 합성 데모만 보셔도 됩니다. 원본 설정이나 snapshot을 보내실 필요는 없습니다. 관심이 있으시면 편한 방식으로 알려주세요. [파일럿 안내](https://github.com/hyscodebase/skillwhy/blob/main/docs/pilot.md)

### English

> Hi, I'm Yuseok, the maintainer of SkillWhy. I read [specific discovery detail] in [your project's document/issue]. I'm building a small OSS tool to compare the skill metadata returned by fresh Codex CLI processes and prepare a minimal support file for one selected entry. I'd value ten minutes of feedback on whether that helps your support workflow. Live capture currently supports Codex CLI 0.166.0 on macOS arm64 and Linux x64 (native Linux checks use Ubuntu 24.04); the synthetic demo needs no Codex or API key. You don't need to send any raw configuration or snapshots. If this is relevant, you're welcome to try the [pilot](https://github.com/hyscodebase/skillwhy/blob/main/docs/pilot.md) or reply in whichever format suits you.

후보별 첫 문장은 실제 관찰에 한정한다. C01에는 이미 존재하는 native verifier를
인정하고 작은 비교·공유 흐름의 필요성을 묻는다. C02·C05에는 Desktop 문제를
CLI 도구가 해결했다고 연결하지 않는다. C03에는 installer 문제의 해결책이라고
소개하지 않는다. C04에는 동기화 이후 관찰이 별도로 필요한지 묻는다.

## 공개 채널 2곳과 적용 규칙

계정별 글쓰기 자격·대기기간·flair 선택지와 규칙 변경 여부는 실제 게시 시 다시
확인한다. 이번 조사에서는 계정 로그인이나 게시 시도를 하지 않았다. 두 초안을
동시에 여러 곳에 배포하지 말고, 한 곳의 질문에 답할 수 있을 때 한 번 소개한다.

### 1. GeekNews Show

- **규칙 확인:** [사이트 이용법](https://news.hada.io/guidelines), [Show GN 안내](https://news.hada.io/blog/show), [이용약관](https://news.hada.io/terms). 약관의 표시된 최종 수정일은 2026-08-16이다.
- **적용:** 본인 제작 도구는 뉴스가 아닌 **Show**로 등록한다. 제목은 `프로젝트명 - 핵심 기능` 형식이며 `Show GN:`은 자동으로 붙는다. 직접 실행 가능한 원본 저장소를 연결하고, 소개만 있는 페이지나 YouTube 링크를 제출하지 않는다. 반복 소개·우회 재등록·지인 투표 요청은 하지 않는다.
- **적합성 판단:** 실행 가능한 OSS를 직접 소개하는 공간이며 합성 demo를 로그인·API 키 없이 실행할 수 있다는 점에서 형식에 맞는다. 현재 live 지원 범위가 좁고 설치에는 Node/Git이 필요하다는 점을 본문 앞부분에 밝힌다. 등록 승인이나 관심을 보장하지 않는다.

**제목 초안:** `SkillWhy - Codex CLI가 발견한 스킬 목록을 비교하는 도구`

**URL:** https://github.com/hyscodebase/skillwhy

**상세 설명 초안:**

> SkillWhy를 만든 홍유석입니다. 같은 저장소를 쓰더라도 각 환경의 skill 발견 결과가 다를 때 비교할 수 있는 CLI를 만들었습니다.
>
> 새 Codex CLI 프로세스가 반환한 목록을 저장하고, 활성 상태·수집한 SKILL.md fingerprint 등의 차이를 보여줍니다. 지원 요청에는 전체 설정 대신 직접 고른 한 항목의 최소 파일을 만들 수 있습니다. 기본 공유 파일에는 이름·경로·본문·fingerprint가 제외되며 자동 업로드는 없습니다.
>
> 현재 live capture는 **Codex CLI 0.166.0 / macOS arm64·Linux x64**를 지원합니다. Linux에서 실제 검증한 환경은 Ubuntu 24.04입니다. 기존 Desktop 세션이나 모델의 실제 skill 선택·실행은 검사하지 않습니다. Node.js 22+가 있으면 다음 합성 데모를 실행할 수 있습니다. 최초 실행에는 빌드된 npm 패키지를 다운로드하며, 데모에는 Codex나 API 키가 필요하지 않습니다.
>
> `npx --yes @hyscodebase/skillwhy@alpha demo`
>
> TypeScript로 작성했고 runtime dependency는 없습니다. native 발견 검증 자체를 새로 발명한 것은 아니며, 작은 비교 결과와 검토 가능한 공유 파일에 범위를 좁혔습니다. 아직 외부 파일럿 결과는 없습니다. 출력에서 “확인된 차이”와 “아직 모르는 것”이 잘 구분되는지 피드백을 받고 싶습니다. 원본 설정이나 snapshot을 올리지 않아도 됩니다.
>
> 개발과 이 초안 작성에 AI의 도움을 받았습니다.

### 2. Reddit r/sideprojects — 복수형

- **규칙 확인:** [공식 커뮤니티 규칙 JSON](https://www.reddit.com/r/sideprojects/about/rules.json), [규칙 화면](https://www.reddit.com/r/sideprojects/about/rules/). `r/SideProject`와 다른 커뮤니티이므로 섞어 쓰지 않는다.
- **적용:** 해결하는 문제·구현 기술·실행 방법처럼 링크 외의 정보도 본문에 넣는다. 반복적인 자기 홍보, 제휴 링크, DM으로 정보를 받게 하는 방식, 제작자 관계를 숨기는 행위가 금지된다. 프로젝트에 맞는 showcase flair를 쓰고, 이 AI 개발 프로젝트에는 규칙의 **vibecoded showcase** 계열을 선택한다. 정확한 현재 선택지는 게시 화면에서 확인한다.
- **적합성 판단:** 직접 만든 프로젝트의 구현과 피드백을 공개하는 형식에 맞는다. 다만 일반 제작자 커뮤니티이므로 Codex 유지관리자가 실제로 응답할지는 미확인이다. 자발적 문제 설명과 사용 시도만 기록하며 노출이나 추천 수를 제품 수요로 바꾸지 않는다.

**Title draft:** `SkillWhy: comparing the skills that fresh Codex CLI processes discover`

**Post draft:**

> I'm the maintainer of SkillWhy, an early MIT-licensed CLI. I built it to investigate a narrow support question: do two environments using the same repository actually report the same skills?
>
> It asks a fresh local Codex CLI process for skill metadata, compares saved observations, and can prepare a small support file containing one explicitly selected entry. Names, paths, skill bodies, and fingerprints are excluded from that file by default. You review and share it yourself; the tool does not upload it.
>
> The implementation is TypeScript with no runtime dependencies. One deliberate boundary is that discovery does not prove a model selected, read, or executed a skill. SkillWhy also does not inspect an existing Desktop session or choose a winner among same-name copies.
>
> Live capture currently supports **Codex CLI 0.166.0 on macOS arm64 and Linux x64**, with Linux native checks on Ubuntu 24.04. For a synthetic demo, you need Node.js 22+, but no Codex installation or API key:
>
> `npx --yes @hyscodebase/skillwhy@alpha demo`
>
> The first run downloads the compiled npm package. Code and instructions: https://github.com/hyscodebase/skillwhy
>
> There are no completed external pilots yet. I'd appreciate feedback on whether the result makes observed differences and unknowns clear. If you've had a similar support problem, what information was missing from your existing tools? No raw snapshots or private configuration are needed.
>
> Disclosure: I'm the creator; development and this draft were AI-assisted.

## 이번에 제외한 채널 / Channels not selected for these drafts

- **Hacker News:** [현행 가이드라인](https://news.ycombinator.com/newsguidelines.html)은 생성된 게시글과 AI 작성·편집 댓글을 금지한다. 그래서 이 문서의 AI 작성 문안을 HN에 붙여 넣는 계획은 만들지 않는다. 나중에 제작자가 직접 글을 쓴다면 [Show HN 조건](https://news.ycombinator.com/showhn.html)을 별도로 검토할 수 있다.
- **DEV:** [현재 AI 글 가이드](https://dev.to/guidelines-for-ai-assisted-articles-on-dev)는 AI 사용 고지와 사실 검토를 요구하며 자기 프로그램 홍보를 제한한다. [일반 콘텐츠 정책](https://dev.to/terms)도 홍보·backlink가 주목적인 글을 제한한다. 이번 목적의 홍보 초안을 적합하다고 단정하지 않고 제외했다.

## 게시·응답 기록 — 아직 실행하지 않음

| 항목 | 날짜 | 상태 | 공개 링크 | 실제 시도 / 해석 / 유용한 사례 |
| --- | --- | --- | --- | --- |
| GeekNews Show | — | 초안만 준비 | — | 0 / 0 / 0 |
| r/sideprojects | — | 초안만 준비 | — | 0 / 0 / 0 |
| 개별 초대 | — | 미발송 | — | 0 / 0 / 0 |

게시 후에는 각 채널의 관련 질문에 직접 답하고, 차단되거나 삭제된 글을 같은
내용으로 재게시하지 않는다. 반응이 없으면 문구·대상·문제 가설을 재검토한다.
스타·upvote·댓글을 대가로 참여를 요청하거나 실제 사용 사례를 만들어 쓰지 않는다.
