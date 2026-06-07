
export function Legend() {
  return (
    <div id="legend">
      <h3>Floor Type</h3>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#4a90d9' }} /> Office</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#bd10e0' }} /> Amenity</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#7ed321' }} /> Circulation</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#9b9b9b' }} /> Core</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#f5a623' }} /> Plant</div>
      <hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '8px 0' }} />
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#c8ccd8' }} /> Inner wall</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#ffffff' }} /> Door</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#ff6b4a' }} /> Stair (solid run)</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#ff3df0', opacity: 0.6 }} /> Lift shaft</div>
      <div className="legend-item"><div className="legend-swatch" style={{ background: '#00ff9c' }} /> Entrance / exit</div>
    </div>
  );
}
