/**
 * يوقف طلبات خفيفة الدورية (مثل unread-count) أثناء رفع ثقيل
 * لتحرير خانات الاتصال المتزامنة في المتصفح (HTTP/1.1 ~6/host).
 */
let lockCount = 0;

export function beginHeavyUpload() {
  lockCount += 1;
}

export function endHeavyUpload() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sawa-heavy-upload-ended'));
  }
}

export function isHeavyUploadLocked() {
  return lockCount > 0;
}
