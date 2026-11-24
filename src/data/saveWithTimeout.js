// Firestore writes can wait indefinitely while the browser is offline.
// A timeout does not prove the server rejected the write; refresh before retrying.
export function saveWithTimeout(save, timeoutMs = 15000) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.reject(new Error('You are offline.'));
  }
  let timer;
  const pending = Promise.resolve().then(save);
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Saving timed out. Check your connection.')), timeoutMs);
  });
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}
