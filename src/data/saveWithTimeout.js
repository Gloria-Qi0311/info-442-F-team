// Keep pending Firestore writes from leaving forms in a permanent saving state.
// A timed-out write may still finish later; callers should refresh before retrying.
export function saveWithTimeout(save, timeoutMs = 15000) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.reject(new Error('You are offline. Your changes were not confirmed.'));
  }
  let timer;
  const pending = Promise.resolve().then(save);
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Saving timed out. Check your connection and refresh before trying again.')), timeoutMs);
  });
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}
