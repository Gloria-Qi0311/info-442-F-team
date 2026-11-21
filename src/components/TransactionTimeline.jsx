import './TransactionTimeline.css';

export default function TransactionTimeline({ stages = [], currentStage }) {
  const currentIndex = stages.indexOf(currentStage);

  return (
    <ol className="txn-timeline" aria-label="Transaction timeline">
      {stages.map((stage, index) => {
        const state = currentIndex === -1 || index > currentIndex
          ? 'upcoming'
          : index === currentIndex ? 'current' : 'completed';
        return (
          <li key={stage} className={`txn-timeline-step ${state}`}
              aria-current={state === 'current' ? 'step' : undefined}>
            <span className="txn-timeline-marker" aria-hidden="true">
              {state === 'completed' ? '✓' : index + 1}
            </span>
            <span className="txn-timeline-label">{stage}</span>
            <span className="sr-only">
              {state === 'completed' ? ' (completed)' : state === 'current' ? ' (current stage)' : ' (upcoming)'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}