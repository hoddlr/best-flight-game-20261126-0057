// Keyboard and pointer input. Held keys steer and work the throttle;
// one-shot presses (start, restart, pause, mute) are queued as bit flags
// and taken once by the loop, so a press between frames is never lost.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_DOWN = new Set(['ArrowLeft', 'KeyA']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const state = {
    pitchUp: false,
    pitchDown: false,
    throttleUp: false,
    throttleDown: false,
    actions: 0,
    mouseX: 0,
    mouseY: 0,
    clicked: false,
  };

  window.addEventListener('keydown', (event) => {
    if (PITCH_UP.has(event.code)) state.pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) state.pitchDown = true;
    else if (THROTTLE_UP.has(event.code)) state.throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) state.throttleDown = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) state.actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) state.actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) state.actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (PITCH_UP.has(event.code)) state.pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) state.pitchDown = false;
    else if (THROTTLE_UP.has(event.code)) state.throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) state.throttleDown = false;
  });
  window.addEventListener('blur', () => {
    state.pitchUp = false;
    state.pitchDown = false;
    state.throttleUp = false;
    state.throttleDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    state.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    state.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
    state.clicked = true;
    state.actions |= ACTION_CONFIRM;
  });
  return state;
}

/** Take and clear the queued one-shot actions. */
export function takeActions(state) {
  const taken = state.actions;
  state.actions = 0;
  return taken;
}

/** Take and clear the last mouse click, if any. */
export function takeClick(state) {
  if (!state.clicked) return null;
  state.clicked = false;
  return { x: state.mouseX, y: state.mouseY };
}
