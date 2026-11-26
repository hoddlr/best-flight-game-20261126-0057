// mat.js — small column-major mat4 / vec3 helpers for the raw WebGL engine.
// No library: these few functions are the whole math layer. Matrices are
// Float32Array(16) in the order WebGL expects (column-major).

export function matIdentity() {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  return m;
}

export function matMultiply(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

export function matPerspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function vecCross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function vecDot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vecLength(a) {
  return Math.hypot(a[0], a[1], a[2]);
}

export function vecNormalize(a) {
  const l = vecLength(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Camera matrix: eye looks at target, up is roughly world-up.
export function matLookAt(eye, target, up) {
  const z = vecNormalize(vecSub(eye, target));
  const x = vecNormalize(vecCross(up, z));
  const y = vecCross(z, x);
  const m = matIdentity();
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
  m[12] = -vecDot(x, eye);
  m[13] = -vecDot(y, eye);
  m[14] = -vecDot(z, eye);
  return m;
}

// A model matrix from a position plus yaw (heading), pitch and roll.
// Aircraft order: R = Ry(yaw) * Rz(pitch) * Rx(roll), model forward +x.
export function matFromPose(x, y, z, yaw, pitch, roll) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const m = new Float32Array(16);
  m[0] = cy * cp;
  m[1] = sp;
  m[2] = -sy * cp;
  m[4] = -cy * sp * cr + sy * sr;
  m[5] = cp * cr;
  m[6] = sy * sp * cr + cy * sr;
  m[8] = cy * sp * sr + sy * cr;
  m[9] = -cp * sr;
  m[10] = -sy * sp * sr + cy * cr;
  m[12] = x; m[13] = y; m[14] = z; m[15] = 1;
  return m;
}

export function matTranslate(x, y, z) {
  const m = matIdentity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

export function matScale(sx, sy, sz) {
  const m = matIdentity();
  m[0] = sx; m[5] = sy; m[10] = sz;
  return m;
}

export function matRotateY(a) {
  const c = Math.cos(a), s = Math.sin(a);
  const m = matIdentity();
  m[0] = c; m[2] = -s;
  m[8] = s; m[10] = c;
  return m;
}
