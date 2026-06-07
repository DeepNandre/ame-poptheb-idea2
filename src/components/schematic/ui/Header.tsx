
export function Header({ stats }: { stats: string }) {
  return (
    <div id="header">
      <div>
        <h1>ARBOR · Bankside Yards</h1>
        <div className="subtitle">
          Building 1 — Exposed Structure (floors · inner walls · doors · stairs)
        </div>
      </div>
      <div id="stats">{stats}</div>
    </div>
  );
}
