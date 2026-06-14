import { useEffect, useState, type FormEvent } from 'react';
import type { StandingRow } from '../../shared/types';
import { api } from '../api';
import { ParticipantProgressModal } from '../components/ParticipantProgressModal';

export function StandingsView({ isAdmin }: { isAdmin: boolean }) {
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newHandicap, setNewHandicap] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editHandicap, setEditHandicap] = useState('');
  const [progressFor, setProgressFor] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState('');

  const reload = () => {
    api.getStandings().then(setStandings).catch((err: Error) => setError(err.message));
  };

  useEffect(reload, []);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const handicap = newHandicap.trim() === '' ? undefined : Number(newHandicap);
      await api.createParticipant(newName, newPassword || undefined, handicap);
      setNewName('');
      setNewPassword('');
      setNewHandicap('');
      setShowForm(false);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveEdit = async (id: number) => {
    setError('');
    try {
      const handicap = editHandicap.trim() === '' ? undefined : Number(editHandicap);
      await api.updateParticipant(id, editName, editPassword || undefined, handicap);
      setEditingId(null);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (row: StandingRow) => {
    if (!window.confirm(`¿Eliminar a ${row.name}? Se borrarán también sus predicciones.`)) {
      return;
    }
    setError('');
    try {
      await api.deleteParticipant(row.participant_id);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const columnCount = isAdmin ? 7 : 6;

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <h2>🏆 Tabla de posiciones</h2>
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancelar' : '+ Participante'}
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}

        {isAdmin && showForm && (
          <form className="inline-form wrap-form" onSubmit={handleCreate}>
            <input
              type="text"
              placeholder="Nombre del nuevo participante"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Contraseña personal (opcional)"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <input
              type="number"
              placeholder="Handicap (ventaja inicial, opcional)"
              value={newHandicap}
              onChange={(event) => setNewHandicap(event.target.value)}
            />
            <button type="submit" className="btn btn-primary">Agregar</button>
          </form>
        )}

        <div className="table-wrap standings">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th className="left">Participante</th>
                <th title="Puntos">
                  <span className="th-full">Puntos</span>
                  <span className="th-short">Pts</span>
                </th>
                <th title="Marcadores exactos (4 pts)">
                  <span className="th-full">Exactos</span>
                  <span className="th-short">E</span>
                </th>
                <th title="Ganador o empate acertado (3 pts)">
                  <span className="th-full">Aciertos</span>
                  <span className="th-short">A</span>
                </th>
                <th title="Predicciones falladas">
                  <span className="th-full">Fallidas</span>
                  <span className="th-short">F</span>
                </th>
                {isAdmin && <th aria-label="Acciones"></th>}
              </tr>
            </thead>
            <tbody>
              {standings.map((row, index) => (
                editingId === row.participant_id ? (
                  <tr key={row.participant_id}>
                    <td colSpan={columnCount}>
                      <div className="edit-stack">
                        <input
                          type="text"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          autoFocus
                        />
                        <input
                          type="text"
                          placeholder="Nueva contraseña (dejar vacío para no cambiarla)"
                          value={editPassword}
                          onChange={(event) => setEditPassword(event.target.value)}
                        />
                        <input
                          type="number"
                          placeholder="Handicap (ventaja inicial)"
                          value={editHandicap}
                          onChange={(event) => setEditHandicap(event.target.value)}
                        />
                        <div className="row-actions">
                          <button className="btn btn-primary" onClick={() => handleSaveEdit(row.participant_id)}>
                            Guardar
                          </button>
                          <button className="btn" onClick={() => setEditingId(null)}>Cancelar</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.participant_id}
                    className={index === 0 ? 'leader clickable-row' : 'clickable-row'}
                    onClick={() => setProgressFor({ id: row.participant_id, name: row.name })}
                    title={`Ver el avance de ${row.name}`}
                  >
                    <td>{index + 1}</td>
                    <td className="left"><span className="link-name">{row.name}</span></td>
                    <td className="strong">
                      {row.points}
                      {row.handicap !== 0 && (
                        <span
                          className="handicap-mark"
                          title={`Incluye ${row.handicap > 0 ? '+' : ''}${row.handicap} de handicap`}
                        >
                          ✱
                        </span>
                      )}
                    </td>
                    <td>{row.exact_hits}</td>
                    <td>{row.outcome_hits}</td>
                    <td>{row.misses}</td>
                    {isAdmin && (
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="kebab-wrap">
                          <button
                            className="kebab"
                            aria-label={`Opciones de ${row.name}`}
                            onClick={() => setMenuOpenId(menuOpenId === row.participant_id ? null : row.participant_id)}
                          >
                            ⋮
                          </button>
                          {menuOpenId === row.participant_id && (
                            <>
                              <div className="menu-backdrop" onClick={() => setMenuOpenId(null)} />
                              <div className="menu">
                                <button
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    setEditingId(row.participant_id);
                                    setEditName(row.name);
                                    setEditPassword('');
                                    setEditHandicap(String(row.handicap));
                                  }}
                                >
                                  ✏️ Editar
                                </button>
                                <button
                                  className="menu-danger"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                    void handleDelete(row);
                                  }}
                                >
                                  🗑️ Eliminar
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
        {standings.length === 0 && <p className="muted">No hay participantes todavía.</p>}
        <p className="muted hint">
          E = marcador exacto (5 pts si fuiste el único, 4 si fue repetido) · A = acertó ganador o empate
          (3 pts) · F = falló (0 pts). A igual puntaje queda primero quien envió su predicción más temprano.
          {standings.some((row) => row.handicap !== 0) && ' ✱ = el puntaje incluye puntos de handicap (ventaja inicial).'}
        </p>
        <p className="muted hint">👆 Toca un nombre para ver cómo ha avanzado partido a partido.</p>
      </section>
      {progressFor && (
        <ParticipantProgressModal
          participantId={progressFor.id}
          name={progressFor.name}
          onClose={() => setProgressFor(null)}
        />
      )}
    </div>
  );
}
