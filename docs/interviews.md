# 유지관리자 인터뷰와 파일럿 기록

**2026-11-02 초기값:** 초대 0, 응답 0, 인터뷰 0, 외부 파일럿 완료 0,
확인된 유용한 사례 0. 문서 작성·개발자 자체 테스트·공개 이슈 조사는
외부 사용자 검증으로 세지 않는다. [후보 조사](research/pilot-candidates.md)는
모집 후보일 뿐 참여자 명단이 아니다.

## 운영 방식

인터뷰는 10~15분을 제안하되 텍스트 응답도 받는다. 제품을 시연하기 전에 최근의
실제 문제와 기존 해결 방식을 먼저 듣는다. 녹음·원본 설정·snapshot 제출을
요청하지 않는다. 공개 기록에는 중립 ID와 참여자가 공개에 동의한 요약만 남긴다.
비공개 연락처와 원문 응답은 이 공개 저장소에 넣지 않는다.

## 질문 5개 / Five questions

1. **최근 사례:** 마지막으로 skill이 기대와 다르게 보이거나 다른 환경과 달랐던 때, 무엇을 하려 했고 무엇을 직접 관찰했나요? 그런 경험이 없다면 없다고 알려주세요.  
   **Recent case:** The last time a skill appeared differently than expected or across environments, what were you trying to do and what did you observe? “I haven't had that problem” is useful too.
2. **현재 해결 방식:** 그때 어떤 명령·문서·사람을 통해 확인했나요? 이미 충분했던 방법과 끝내 확인하지 못한 정보를 구분해 주세요.  
   **Current approach:** What commands, documentation, or people helped you check it? What already worked, and what remained unknown?
3. **문제의 범위:** 당시 문제가 파일 설치, fresh CLI의 발견 목록, 실행 중인 Desktop 세션, 모델의 선택·실행 중 어디에 있었나요? 판단하기 어렵다면 무엇이 부족했나요?  
   **Boundary:** Was the issue installation, a fresh CLI's inventory, an existing Desktop session, or model selection/execution? If you could not tell, what evidence was missing?
4. **공유 가능 범위:** 다른 유지관리자에게 확인을 요청할 때 어떤 정보까지 보내도 괜찮나요? 경로·이름·fingerprint를 제외하면 답할 수 없는 질문이 있나요?  
   **Sharing:** What information would you be comfortable sending for support? Which questions become unanswerable if paths, names, and fingerprints are omitted?
5. **다음 행동:** [10분 파일럿](pilot.md)을 이미 사용하는 환경에서 시도할 의향이 있나요? 실행했다면 어느 결과가 다음 행동에 도움이 됐거나 도움이 되지 않았나요? 다시 쓸 계기가 없다면 그대로 알려주세요.  
   **Next action:** Would you try the ten-minute pilot in an environment you already use? If you tried it, which result changed—or failed to change—your next action? It is fine if you see no reason to reuse it.

시간 절약은 실제 비교 기록이 없으면 수치로 주장하지 않는다. “좋아 보인다”는
답과 실행 의향, 실제 실행, 재사용은 별도 항목이다. 공개 이슈의 옛 환경을 현재
환경으로 채우지 말고, 참여자가 자발적으로 제공한 버전만 기록한다.

## 파일럿 종료와 성공을 따로 판정하기

실행 명령은 중복 복사하지 않고 [pilot.md](pilot.md)를 따른다. 현재 native capture는
**Codex CLI 0.166.0 / macOS arm64·Linux x64**를 지원한다. Linux 검증 환경은 Ubuntu 24.04다. 다른 환경에서는 합성 demo 피드백으로
끝낸다. 파일럿 때문에 Codex 설치·업그레이드·다운그레이드를 요구하지 않는다.

| 분류 | 완료 기준 | 유용한 실제 사례로 집계? |
| --- | --- | --- |
| demo-only | 실행 시도와 성공/막힌 단계, 결과 해석 피드백을 기록 | 아니오 |
| live-attempt | 기존 지원 환경에서 capture → inspect → share preview를 시도하고 결과/오류·소요 시간·도움 유무를 기록 | 시도만으로는 아니오 |
| blocked / unsupported | 막힌 단계 또는 지원 범위 불일치를 기록하고 중단 | 아니오. 제품 마찰 또는 호환성 신호 |
| helpful-live-case | 원래 있던 구체적 문제에 대해 관찰 결과가 다음 진단 행동에 도움이 됐다고 참여자가 설명하고, 짧은 공개 요약의 범위를 확인 | 예. 원인 해결·모델 실행 검증과 구분 |
| independently-understood | 작성자가 설명해 주기 전에 참여자가 관찰된 차이와 여전히 모르는 점을 자기 말로 구분 | 독립 해석 지표. demo/live 구분 필수 |

10분이 지나면 실패나 미완료여도 종료한다. 두 환경 비교는 선택 사항이다.
실행 도중 작성자가 도왔다면 `assisted`로 기록하고, 독립 해석 성공으로 세지 않는다.
두 기기의 참가자가 같은 별칭으로 공유한다면 항목 대응을 각각 확인해야 한다.
원본 snapshot이나 설정 전체를 공개 이슈에 붙이는 것은 완료 조건이 아니다.

## 첫 회차 운영 기준

다음은 성공 예측이 아니라 다음 투자 여부를 판단하기 위한 기준이다.

- 인터뷰 5건에서 서로 다른 유지관리자 2명이 비슷한 최근 문제를 설명하고, 2명이 파일럿 의향을 보이는지 확인한다.
- 외부 파일럿 3건 중 2명이 작성자 도움 없이 결과를 해석하는지 확인한다. demo-only와 live 결과를 따로 보고한다.
- 제품이 도움이 된 실제 live 사례 2건을 확보하기 전에는 검증된 수요나 시간 절약을 홍보하지 않는다.
- 5건을 들어도 현재 범위에 해당하는 문제가 없으면 기능을 넓히기 전에 대상과 문제 정의를 재검토한다. 지원되지 않는 환경 요청은 조합별로 기록하되 추정으로 지원 표를 늘리지 않는다.
- 무응답은 인터뷰 결과가 아니다. 90일의 재사용 유지관리자 5명·다른 프로젝트 지원 문서 채택 2건은 별도 후속 목표이며 현재 달성값은 0이다.

## 응답 기록표 — 아직 실제 응답 없음

아래 빈 행은 템플릿이며 참여나 성공 사례를 뜻하지 않는다. 후보 ID와 연결할
필요가 생겨도 그 사실을 공개해도 되는지 먼저 확인한다.

| 중립 ID | 동의·응답일 | 최근 문제 / 없었음 | 기존 해결 방법 | self-reported 환경 | demo/live/blocked | 도움 제공 여부 | 관찰·다음 행동 | 재사용 의향 / 실제 재사용 | 공개 요약 동의 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 미배정 | — | — | — | — | — | — | — | — | — |

집계할 때는 분모와 날짜를 함께 적는다. 예: `live 시도 0 / 전체 파일럿 0`.
서로 다른 사람 수와 실행 횟수를 구분하고, 비율의 분모가 0이면 `N/A`로 표시한다.
