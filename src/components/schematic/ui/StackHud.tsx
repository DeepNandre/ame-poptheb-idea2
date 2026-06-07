
export function StackHud({ hiddenCount }: { hiddenCount: number }) {
  return (
    <div id="stack-hud">
      <div>
        <b>{hiddenCount}</b> hidden
      </div>
      <div className="keys">
        click = hide · <b>B</b> undo · <b>N</b> redo
      </div>
      <div className="keys">drag orbit · scroll zoom</div>
    </div>
  );
}
