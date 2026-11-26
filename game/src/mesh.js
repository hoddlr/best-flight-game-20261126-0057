// mesh.js — a triangle-soup builder. Callers push faces with a colour and
// the builder works out each face normal, so every mesh is flat-shaded and
// low-poly by construction. All coordinates are local to the mesh.

export function builder() {
  const data = [];
  function tri(a, b, c, color) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c]) {
      data.push(p[0], p[1], p[2], nx, ny, nz, color[0], color[1], color[2]);
    }
  }
  function quad(a, b, c, d, color) {
    tri(a, b, c, color);
    tri(a, c, d, color);
  }
  // An axis-aligned box centred at (cx, cy, cz) with half-sizes hx/hy/hz.
  // Each face may take its own colour through the faces map.
  function box(cx, cy, cz, hx, hy, hz, color, faces) {
    const f = faces || {};
    const top = f.top || color, bottom = f.bottom || color;
    const front = f.front || color, back = f.back || color;
    const left = f.left || color, right = f.right || color;
    const x0 = cx - hx, x1 = cx + hx;
    const y0 = cy - hy, y1 = cy + hy;
    const z0 = cz - hz, z1 = cz + hz;
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], top);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], bottom);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], front);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], back);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], left);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], right);
  }
  // A 4-sided pyramid (cone) with its tip at apex and a square base.
  function pyramid(ax, ay, az, baseY, half, color, side) {
    const s = side || color;
    const p = [ax, ay, az];
    const c = [
      [ax - half, baseY, az - half],
      [ax + half, baseY, az - half],
      [ax + half, baseY, az + half],
      [ax - half, baseY, az + half],
    ];
    for (let i = 0; i < 4; i++) tri(p, c[(i + 1) % 4], c[i], s);
    quad(c[0], c[1], c[2], c[3], color);
  }
  // A flat-topped prism between two rectangles (used for wings and tail).
  function slab(x0, x1, y0, y1, z0, z1, color) {
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], color);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color);
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color);
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], color);
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color);
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color);
  }
  // A ring (torus) around a centre, lying in the plane whose normal is n.
  // Built from tube segments; bright colours make it read as neon.
  function ring(cx, cy, cz, radius, tube, color, normal, segs) {
    const n = normal;
    // Two perpendicular axes spanning the ring plane.
    const ref = Math.abs(n[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const u = norm3(cross3(n, ref));
    const v = norm3(cross3(n, u));
    const tubeSegs = 6;
    const ringAt = (i, j) => {
      const a = (i / segs) * Math.PI * 2;
      const b = (j / tubeSegs) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const cb = Math.cos(b), sb = Math.sin(b);
      const px = cx + (radius + tube * cb) * (ca * u[0] + sa * v[0]) + tube * sb * n[0];
      const py = cy + (radius + tube * cb) * (ca * u[1] + sa * v[1]) + tube * sb * n[1];
      const pz = cz + (radius + tube * cb) * (ca * u[2] + sa * v[2]) + tube * sb * n[2];
      return [px, py, pz];
    };
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < tubeSegs; j++) {
        const a = ringAt(i, j), b = ringAt(i + 1, j);
        const c = ringAt(i + 1, j + 1), d = ringAt(i, j + 1);
        quad(a, b, c, d, color);
      }
    }
  }
  function cross3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }
  function norm3(a) {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  return { data, tri, quad, box, pyramid, slab, ring };
}
