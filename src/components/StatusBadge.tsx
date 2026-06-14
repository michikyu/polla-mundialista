import type { MatchStatus } from '../../shared/types';
import { STATUS_LABELS } from '../format';

export function StatusBadge({ status }: { status: MatchStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}
