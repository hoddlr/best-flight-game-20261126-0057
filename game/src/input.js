// input.js — keyboard state, read once per frame by the game loop.
// Keys are tracked by e.code so layouts do not matter. The game also
// listens for Space (start / restart), P / Escape (pause) and M (mute) as
// edge-triggered actions, which main.js consumes and clears each frame.

export function makeInput() {
  const held = new Set();
  const pressed = new Set();
  const codes = {
    KeyW: 'pitchUp', ArrowUp: 'pitchUp',
    KeyS: 'pitchDown', ArrowDown: 'pitchDown',
    KeyA: 'throttleDown', ArrowLeft: 'throttleDown',
    KeyD: 'throttleUp', ArrowRight: 'throttleUp',
    KeyQ: 'bankLeft', KeyE: 'bankRight',
  };
  function onDown(e) {
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onUp(e) {
    held.delete(e.code);
  }
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  // Mouse steering: hold the left button and drag sideways to bank.
  let mouseBank = 0;
  let dragging = false;
  let lastX = 0;
  window.addEventListener('mousedown', (e) => {
    dragging = true;
    lastX = e.clientX;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
    mouseBank = 0;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseBank = Math.max(-1, Math.min(1, mouseBank + (e.clientX - lastX) * 0.004));
    lastX = e.clientX;
  });
  return {
    state() {
      const s = {
        pitchUp: false, pitchDown: false,
        throttleUp: false, throttleDown: false,
        bankLeft: false, bankRight: false,
      };
      for (const code of held) {
        const name = codes[code];
        if (name) s[name] = true;
      }
      if (mouseBank < -0.12) s.bankLeft = true;
      if (mouseBank > 0.12) s.bankRight = true;
      return s;
    },
    // True once for each physical press since the last call.
    wasPressed(code) {
      return pressed.has(code);
    },
    endFrame() {
      pressed.clear();
    },
  };
}
