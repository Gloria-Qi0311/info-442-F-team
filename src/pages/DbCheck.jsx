import { useState } from 'react';
import { db, usingEmulators } from '../firebase';
import { runHealthCheck } from '../data/healthCheck';

export default function DbCheck() {
  const [message, setMessage] = useState('Hello from Husky Share');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const saved = await runHealthCheck(db, message);
      setResult(saved);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <main className="page">
      <h1>Database check</h1>
      <p>
        Connected to: <strong>{usingEmulators ? 'local emulator' : 'Firebase project'}</strong>
      </p>
      <label htmlFor="msg">Test message</label>
      <input
        id="msg"
        value={message}
        maxLength={100}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button type="button" onClick={handleClick} disabled={loading}>
        {loading ? 'Saving…' : 'Save and read back'}
      </button>

      {result && (
        <p className="ok" role="status">
          ✅ Saved and retrieved document <code>{result.id}</code>: “{result.data.message}”
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          ❌ {error}
        </p>
      )}
    </main>
  );
}
