import { requestDeletion } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
export function DeletionForm() {
  return (
    <form action={requestDeletion} className="form-stack">
      <label>
        요청 내용 <span className="muted">(선택)</span>
        <textarea
          name="reason"
          maxLength={500}
          rows={3}
          placeholder="삭제 범위나 확인할 내용을 500자 이내로 적어 주세요."
        />
      </label>
      <label className="check">
        <input type="checkbox" name="confirm" required />
        <span>
          운영자에게 계정 삭제 검토를 요청합니다. 접수만으로 계정이 삭제되지
          않음을 확인했습니다.
        </span>
      </label>
      <SubmitButton secondary>삭제 검토 요청</SubmitButton>
    </form>
  );
}
