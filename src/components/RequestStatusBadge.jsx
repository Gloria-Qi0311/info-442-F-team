
import './RequestStatusBadge.css';

export default function RequestStatusBadge({ status }) {
  const statusLabels = {
    pending: 'Pending',
    approved: 'Approved',
    declined: 'Declined',
    canceled: 'Canceled'
  };

  const normalizedStatus = String(status || '')
    .toLowerCase();

  const label = statusLabels[normalizedStatus] || 'Unknown';

  return (
    <span className={`request-status-badge ${normalizedStatus}`}>
      {label}
    </span>
  );
}
