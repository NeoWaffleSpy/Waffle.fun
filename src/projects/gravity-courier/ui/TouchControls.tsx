import type { PointerEvent } from 'react';
import type { InputState } from '../input';
import { IN_LEFT, IN_RIGHT, IN_THRUST } from '../sim/constants';

/** On-screen buttons for touch devices (shown via CSS on coarse pointers). */
export function TouchControls({ input }: { input: InputState }) {
  const bind = (bit: number) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      input.setTouch(bit, true);
    },
    onPointerUp: () => {
      input.setTouch(bit, false);
    },
    onPointerCancel: () => {
      input.setTouch(bit, false);
    },
    onContextMenu: (e: { preventDefault: () => void }) => {
      e.preventDefault();
    },
  });
  return (
    <div className="gc-touch" aria-hidden="true">
      <div className="gc-touch__turn">
        <button type="button" tabIndex={-1} {...bind(IN_LEFT)}>
          ⟲
        </button>
        <button type="button" tabIndex={-1} {...bind(IN_RIGHT)}>
          ⟳
        </button>
      </div>
      <button type="button" tabIndex={-1} className="gc-touch__thrust" {...bind(IN_THRUST)}>
        Thrust
      </button>
    </div>
  );
}
