import { useState, type ReactNode } from 'react';
import type { Match, MatchStage } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { KNOCKOUT_BRACKET, type BracketSlot } from '../../shared/bracket';
import { formatKickoff, STATUS_ICONS, STATUS_LABELS } from '../format';
import { TeamLabel } from './TeamLabel';

interface Props {
  matches: Match[];
  onOpenMatch: (id: number) => void;
  onlyReal?: boolean; // solo rondas con equipos definidos
  showFilter?: boolean; // muestra el selector de fase (y el árbol en "Todas")
}

const KNOCKOUT_STAGES: MatchStage[] = STAGE_ORDER.filter((s) => s !== 'grupos');
// El árbol no incluye el tercer puesto (no es parte del cuadro principal).
const TREE_STAGES: MatchStage[] = KNOCKOUT_STAGES.filter((s) => s !== 'tercer_puesto');

const SHORT_LABELS: Record<string, string> = {
  dieciseisavos: '16avos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semifinal: 'Semis',
  tercer_puesto: '3.º',
  final: 'Final',
};

// Etiqueta corta para los cupos por definir: "1.º Grupo E" → "1E", "3.º A/B/C/D/F" → "3·ABCDF",
// "Gana P73" → "▸73", "Pierde P101" → "✗101".
function compactLabel(s: string): string {
  return s
    .replace('1.º Grupo ', '1')
    .replace('2.º Grupo ', '2')
    .replace('3.º ', '3·')
    .replace('Gana P', '▸')
    .replace('Pierde P', '✗')
    .replace(/\//g, '');
}

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

  const matchCard = (match: Match, compact: boolean): ReactNode => {
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
        title={`${match.home_team} vs ${match.away_team} · ${STATUS_LABELS[match.status]}`}
      >
        <div className={homeWon ? 'bk-row winner' : 'bk-row'}>
          <TeamLabel name={match.home_team} side="home" />
          <span className="bk-score">{done ? hs : ''}</span>
        </div>
        <div className={awayWon ? 'bk-row winner' : 'bk-row'}>
          <TeamLabel name={match.away_team} side="home" />
          <span className="bk-score">{done ? as : ''}</span>
        </div>
        {!compact && (
          <div className="bk-meta">
            {STATUS_ICONS[match.status]} {formatKickoff(match.kickoff)}
          </div>
        )}
      </button>
    );
  };

  const slotCard = (slot: BracketSlot, compact: boolean): ReactNode => (
    <div key={slot.matchNumber} className="bk-card placeholder" title={`${slot.home} vs ${slot.away}`}>
      <div className="bk-row tbd">{compact ? compactLabel(slot.home) : slot.home}</div>
      <div className="bk-row tbd">{compact ? compactLabel(slot.away) : slot.away}</div>
      {!compact && (
        <div className="bk-meta">
          <span className="bracket-num">P{slot.matchNumber}</span> · {formatKickoff(slot.kickoff)}
        </div>
      )}
    </div>
  );

  const cardsFor = (stage: MatchStage, compact = false): ReactNode[] => {
    const real = realByStage.get(stage) ?? [];
    if (real.length > 0) {
      return real.map((m) => matchCard(m, compact));
    }
    return KNOCKOUT_BRACKET.filter((s) => s.stage === stage).map((slot) => slotCard(slot, compact));
  };

  const renderRound = (stage: MatchStage) => (
    <div key={stage} className="bk-round">
      <h3 className="bk-stage-name">{STAGE_LABELS[stage]}</h3>
      <div className="bk-cards">{cardsFor(stage)}</div>
    </div>
  );

  // Vista por defecto en "Todas las fases": cuadro/árbol horizontal (estilo FIFA/FoxSports).
  const showTree = showFilter && filter === 'todos';
  const treeStages = TREE_STAGES.filter((s) => availableStages.includes(s));
  const shownStages =
    filter !== 'todos' && availableStages.includes(filter) ? [filter] : availableStages;

  return (
    <div className="bk">
      {showFilter && (
        <label className="select-label stage-filter">
          Filtrar por fase
          <select value={filter} onChange={(e) => setFilter(e.target.value as 'todos' | MatchStage)}>
            <option value="todos">Todas las fases (cuadro completo)</option>
            {availableStages.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
        </label>
      )}

      {showTree ? (
        <>
          <div className="bk-tree">
            {treeStages.map((stage) => (
              <div key={stage} className="bk-tree-col">
                <div className="bk-tree-col-title">{SHORT_LABELS[stage]}</div>
                <div className="bk-tree-col-body">{cardsFor(stage, true)}</div>
              </div>
            ))}
          </div>
          {availableStages.includes('tercer_puesto') && (
            <div className="bk-third">{renderRound('tercer_puesto')}</div>
          )}
        </>
      ) : (
        <div className="bracket">{shownStages.map(renderRound)}</div>
      )}
    </div>
  );
}
