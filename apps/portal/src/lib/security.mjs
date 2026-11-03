export function trustedOrigin(origin, expected) {
  if (!origin || !expected || /[\u0000-\u0020\u007f]/.test(origin))
    return false;
  try {
    return origin === new URL(expected).origin;
  } catch {
    return false;
  }
}
export function validDisplayName(value) {
  return (
    typeof value === "string" &&
    value.trim().length >= 1 &&
    value.trim().length <= 80 &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}
