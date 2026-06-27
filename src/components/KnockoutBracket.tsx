import type { ReactNode } from 'react';
import type { Match, MatchStage } from '../../shared/types';
import { STAGE_LABELS, STAGE_ORDER } from '../../shared/types';
import { KNOCKOUT_BRACKET, type BracketSlot } from '../../shared/bracket';
import { formatKickoff, STATUS_ICONS, STATUS_LABELS } from '../format';
import { TeamLabel } from './TeamLabel';

interface Props {
  matches: Match[];
  onOpenMatch: (id: number) => void;
  onlyReal?: boolean; // solo rondas con equipos definidos
  mode?: 'tree' | 'list'; // cuadro horizontal o lista apilada
}

const KNOCKOUT_STAGES: MatchStage[] = STAGE_ORDER.filter((s) => s !== 'grupos');
const TREE_STAGES: MatchStage[] = KNOCKOUT_STAGES.filter((s) => s !== 'tercer_puesto');

const SHORT_LABELS: Record<string, string> = {
  dieciseisavos: '16avos',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semifinal: 'Semis',
  tercer_puesto: '3.º',
  final: 'Final',
};

// Cupo por definir, en versión corta y legible para el cuadro:
// "1.º Grupo E" → "1E"; "3.º A/B/C/D/F" → "3.º" + "ABCDF"; "Gana P73" → "▸ 73".
function tbdLabel(s: string): ReactNode {
  const pos = s.match(/^([12])\.º Grupo (\w+)$/);
  if (pos) {
    return `${pos[1]}${pos[2]}`;
  }
  const third = s.match(/^3\.º (.+)$/);
  if (third) {
    return (
      <span className="bk-tbd3">
        <b>3.º</b>
        <span className="bk-tbd-groups">{third[1].replace(/\//g, '')}</span>
      </span>
    );
  }
  const win = s.match(/^Gana P(\d+)$/);
  if (win) {
    return `▸ ${win[1]}`;
  }
  const lose = s.match(/^Pierde P(\d+)$/);
  if (lose) {
    return `✗ ${lose[1]}`;
  }
  return s;
}

export function KnockoutBracket({ matches, onOpenMatch, onlyReal = false, mode = 'tree' }: Props) {
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
      <div className="bk-row tbd">{compact ? tbdLabel(slot.home) : slot.home}</div>
      <div className="bk-row tbd">{compact ? tbdLabel(slot.away) : slot.away}</div>
      {!compact && (
        <div className="bk-meta">
          <span className="bracket-num">P{slot.matchNumber}</span> · {formatKickoff(slot.kickoff)}
        </div>
      )}
    </div>
  );

  const cardsFor = (stage: MatchStage, compact: boolean): ReactNode[] => {
    const real = realByStage.get(stage) ?? [];
    // En Inicio (onlyReal) solo se muestran los cruces ya definidos, sin plantilla.
    if (onlyReal) {
      return real.map((m) => matchCard(m, compact));
    }

    const slots = KNOCKOUT_BRACKET.filter((s) => s.stage === stage);
    if (slots.length === 0) {
      return real.map((m) => matchCard(m, compact));
    }

    // Cada cupo muestra su partido real si ya existe, o el placeholder si no. Como los
    // partidos reales no guardan su número de cuadro, se enlazan por hora (exacta o, si no,
    // por mismo día). Así NUNCA se ocultan cupos aunque solo algunos cruces estén definidos.
    const slotToReal = new Map<number, Match>();
    const usedReal = new Set<number>();
    for (const slot of slots) {
      const m = real.find((r) => !usedReal.has(r.id) && r.kickoff === slot.kickoff);
      if (m) {
        slotToReal.set(slot.matchNumber, m);
        usedReal.add(m.id);
      }
    }
    for (const m of real) {
      if (usedReal.has(m.id)) {
        continue;
      }
      const day = m.kickoff.slice(0, 10);
      const slot = slots.find((s) => !slotToReal.has(s.matchNumber) && s.kickoff.slice(0, 10) === day);
      if (slot) {
        slotToReal.set(slot.matchNumber, m);
        usedReal.add(m.id);
      }
    }

    const cards = slots.map((slot) => {
      const m = slotToReal.get(slot.matchNumber);
      return m ? matchCard(m, compact) : slotCard(slot, compact);
    });
    // Cualquier partido real que no calce con un cupo se agrega igual (no se pierde).
    const extras = real.filter((m) => !usedReal.has(m.id)).map((m) => matchCard(m, compact));
    return [...cards, ...extras];
  };

  // Lista apilada (para Inicio): cada ronda con su título y tarjetas grandes.
  if (mode === 'list') {
    return (
      <div className="bracket">
        {availableStages.map((stage) => (
          <div key={stage} className="bk-round">
            <h3 className="bk-stage-name">{STAGE_LABELS[stage]}</h3>
            <div className="bk-cards">{cardsFor(stage, false)}</div>
          </div>
        ))}
      </div>
    );
  }

  // Cuadro/árbol: 5 columnas que siempre caben + tercer puesto aparte.
  const treeStages = TREE_STAGES.filter((s) => availableStages.includes(s));
  return (
    <div className="bk">
      <div className="bk-tree">
        {treeStages.map((stage) => (
          <div key={stage} className="bk-tree-col">
            <div className="bk-tree-col-title">{SHORT_LABELS[stage]}</div>
            <div className="bk-tree-col-body">{cardsFor(stage, true)}</div>
          </div>
        ))}
      </div>
      {availableStages.includes('tercer_puesto') &&
        (() => {
          const real = realByStage.get('tercer_puesto') ?? [];
          const slot = KNOCKOUT_BRACKET.find((s) => s.stage === 'tercer_puesto');
          return (
            <div className="bk-third">
              <h3 className="bk-stage-name">🥉 Tercer puesto</h3>
              <div className="bk-cards">
                {real.length > 0
                  ? matchCard(real[0], false)
                  : slot && (
                      <div className="bk-card placeholder" title="Los dos perdedores de las semifinales">
                        <div className="bk-row tbd">Perdedor semifinal 1</div>
                        <div className="bk-row tbd">Perdedor semifinal 2</div>
                        <div className="bk-meta">{formatKickoff(slot.kickoff)}</div>
                      </div>
                    )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
