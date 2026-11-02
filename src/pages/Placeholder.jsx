// Temporary page for screens built in later milestones.
export default function Placeholder({ title, note }) {
  return (
    <main className="page">
      <h1>{title}</h1>
      <p className="placeholder">{note}</p>
    </main>
  );
}
