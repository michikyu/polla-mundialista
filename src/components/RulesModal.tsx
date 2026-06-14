export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Reglas de la polla" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📜 Reglas de la polla</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <h3>Puntaje por partido</h3>
        <table className="table rules-table">
          <tbody>
            <tr>
              <td className="left">🎯 Marcador exacto y fuiste el <strong>único</strong></td>
              <td className="strong">5 pts</td>
            </tr>
            <tr>
              <td className="left">🎯 Marcador exacto <strong>repetido</strong> (otros también)</td>
              <td className="strong">4 pts</td>
            </tr>
            <tr>
              <td className="left">✅ Acertaste ganador o empate (sin marcador exacto)</td>
              <td className="strong">3 pts</td>
            </tr>
            <tr>
              <td className="left">❌ No acertaste</td>
              <td className="strong">0 pts</td>
            </tr>
          </tbody>
        </table>

        <h3>Cómo se juega</h3>
        <ul className="rules-list">
          <li>📝 La predicción se registra <strong>una sola vez</strong> y no se puede cambiar. Piénsala bien.</li>
          <li>🤫 Las predicciones de los demás son <strong>secretas</strong> hasta que empiece el partido; antes solo se ve quién ya puso la suya.</li>
          <li>🔒 Cada partido se cierra solo a su hora de inicio (hora de Colombia). Después de eso ya no se puede predecir.</li>
          <li>⚖️ A igual puntaje en la tabla, queda primero quien envió su predicción más temprano.</li>
          <li>🔑 Cada uno registra sus predicciones con su contraseña personal.</li>
        </ul>
      </div>
    </div>
  );
}
