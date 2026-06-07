// Hide / undo / redo as a pure reducer (ported from the undoStack/redoStack logic
// in index.html). Kept pure so it can be unit-tested and driven by useReducer.

export interface HideState {
  hidden: Set<string>;
  undo: string[];
  redo: string[];
}

export type HideAction =
  | { type: 'hide'; id: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset' };

export const initialHideState: HideState = {
  hidden: new Set(),
  undo: [],
  redo: [],
};

export function hideReducer(state: HideState, action: HideAction): HideState {
  switch (action.type) {
    case 'hide': {
      if (state.hidden.has(action.id)) return state; // already hidden → no-op
      const hidden = new Set(state.hidden);
      hidden.add(action.id);
      return { hidden, undo: [...state.undo, action.id], redo: [] };
    }
    case 'undo': {
      if (state.undo.length === 0) return state;
      const undo = state.undo.slice();
      const id = undo.pop()!;
      const hidden = new Set(state.hidden);
      hidden.delete(id);
      return { hidden, undo, redo: [...state.redo, id] };
    }
    case 'redo': {
      if (state.redo.length === 0) return state;
      const redo = state.redo.slice();
      const id = redo.pop()!;
      const hidden = new Set(state.hidden);
      hidden.add(id);
      return { hidden, undo: [...state.undo, id], redo };
    }
    case 'reset':
      return { hidden: new Set(), undo: [], redo: [] };
    default:
      return state;
  }
}
