import type { SyntheticEvent } from 'react';
import { getTeam } from '../../shared/teams';

interface Props {
  name: string;
  side: 'home' | 'away';
  full?: boolean;
}

function hideBrokenFlag(event: SyntheticEvent<HTMLImageElement>): void {
  event.currentTarget.style.display = 'none';
}

function Flag({ alpha2 }: { alpha2: string | null }) {
  if (!alpha2) {
    return null;
  }
  return (
    <img
      className="flag-img"
      src={`https://flagcdn.com/24x18/${alpha2}.png`}
      srcSet={`https://flagcdn.com/48x36/${alpha2}.png 2x`}
      alt=""
      loading="lazy"
      onError={hideBrokenFlag}
    />
  );
}

export function TeamLabel({ name, side, full = false }: Props) {
  const team = getTeam(name);
  const label = full ? name : team.code;
  return (
    <span className="team" title={name}>
      {side === 'home' ? (
        <>
          <Flag alpha2={team.alpha2} /> <span className="team-name">{label}</span>
        </>
      ) : (
        <>
          <span className="team-name">{label}</span> <Flag alpha2={team.alpha2} />
        </>
      )}
    </span>
  );
}
