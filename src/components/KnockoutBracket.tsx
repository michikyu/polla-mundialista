import { useState } from 'react';
import type { Match, MatchStage } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { KNOCKOUT_BRACKET } from '../../shared/bracket';
import { formatKickoff, STATUS_ICONS, STATUS_LABELS } from '../format';
import { TeamLabel } from './TeamLabel';

interface Props {
  matches: Match[];
  onOpenMatch: (id: number) => void;
  // onlyReal: solo rondas que ya tienen partidos con equipos definidos.
  onlyReal?: boolean;
  // showFilter: muestra el selector de fase (default sí).
  showFilter?: boolean;
}

const KNOCKOUT_STAGES: MatchStage[] = STAGE_ORDER.filter((s) => s !== 'grupos');

export function KnockoutBracket({ matches, onOpenMatch, onlyReal = false, showFilter = true }: Props) {
  const [filter, setFilter] = useState<'todos' | MatchStage>('todos');

  const realByStage = new Map<MatchStage, Match[]>();
  for (const stage of KNOCKOUT_STAGES) {
    realByStage.set(
      stage,
      matches.filter((m) => m.stage === stage).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    );
  }

  const availableStages = onlyReal
    ? KNOCKOUT_STAGES.filter((s) => (realByStage.get(s) ?? []).length > 0)
    : KNOCKOUT_STAGES;

  if (availableStages.length === 0) {
    return null;
  }

  const shownStages =
    filter !== 'todos' && availableStages.includes(filter) ? [filter] : availableStages;

  const renderRound = (stage: MatchStage) => {
    const real = realByStage.get(stage) ?? [];
    const slots = KNOCKOUT_BRACKET.filter((s) => s.stage === stage);
    return (
      <div key={stage} className="bk-round">
        <h3 className="bk-stage-name">{STAGE_LABELS[stage]}</h3>
        <div className="bk-cards">
          {real.length > 0
            ? real.map((match) => {
                const done = match.status === 'finalizado';
                const hs = match.home_score;
                const as = match.away_score;
                const homeWon = done && hs !== null && as !== null && hs > as;
                const awayWon = done && hs !== null && as !== null && as > hs;
                return (
                  <button
                    key={match.id}
                    className="bk-card"
                    onClick={() => onOpenMatch(match.id)}
                    title={STATUS_LABELS[match.status]}
                  >
                    <div className={homeWon ? 'bk-row winner' : 'bk-row'}>
                      <TeamLabel name={match.home_team} side="home" />
                      <span className="bk-score">{done ? hs : ''}</span>
                    </div>
                    <div className={awayWon ? 'bk-row winner' : 'bk-row'}>
                      <TeamLabel name={match.away_team} side="home" />
                      <span className="bk-score">{done ? as : ''}</span>
                    </div>
                    <div className="bk-meta">
                      {STATUS_ICONS[match.status]} {formatKickoff(match.kickoff)}
                    </div>
                  </button>
                );
              })
            : slots.map((slot) => (
                <div key={slot.matchNumber} className="bk-card placeholder">
                  <div className="bk-row tbd">{slot.home}</div>
                  <div className="bk-row tbd">{slot.away}</div>
                  <div className="bk-meta">
                    <span className="bracket-num">P{slot.matchNumber}</span> · {formatKickoff(slot.kickoff)}
                  </div>
                </div>
              ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bk">
      {showFilter && (
        <label className="select-label stage-filter">
          Filtrar por fase
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'todos' | MatchStage)}>
            <option value="todos">Todas las fases (bracket completo)</option>
            {availableStages.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
        </label>
      )}
      <div className="bracket">{shownStages.map(renderRound)}</div>
    </div>
  );
}
