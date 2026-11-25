// Firestore writes can wait indefinitely while the browser is offline.
// A timeout does not prove the server rejected the write; refresh before retrying.
// `save` receives `isExpired()` and the deadline (ms since epoch), so a transaction
// can refuse to write after the timeout.
export function saveWithTimeout(save, timeoutMs = 15000) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new Error('You are offline.'));
  }
  let timer;
  let expired = false;
  const deadline = Date.now() + timeoutMs;
  const pending = Promise.resolve().then(() => save(() => expired, deadline));
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error('Saving timed out. Check your connection.'));
    }, timeoutMs);
  });
  return Promise.race([pending, timeout]).finally(() => clearTimeout(timer));
}

// Turns an error into text that is safe to show. Messages the app wrote itself
// (like "Please upload a photo." or "You are offline.") are kept. Firebase and
// security-rules errors carry a `code` and internal details (for example
// "evaluation error at L345 ..."), so they are logged and replaced by `fallback`.
export function userMessage(cause, fallback) {
  if (!cause || cause.code || !cause.message) {
    if (cause) console.error(cause);
    return fallback;
  }
  return cause.message;
}
