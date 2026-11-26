// glx.js — the raw WebGL layer: one flat-shaded program, one mesh builder.
// Every triangle carries its own face normal and vertex colour, so the
// low-poly look comes from the geometry itself, not from textures (there
// are none). Fog and a warm sun give the golden-hour grade.

export const VERT_SRC = `
attribute vec3 aPos;
attribute vec3 aNormal;
attribute vec3 aColor;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform vec3 uSunDir;
uniform vec3 uFogColor;
uniform vec2 uFogRange;
uniform float uEmissive;
varying vec3 vColor;
varying float vFog;
void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vec3 n = normalize(mat3(uModel) * aNormal);
  float diff = max(dot(n, normalize(uSunDir)), 0.0);
  float light = 0.42 + 0.58 * diff;
  vec3 lit = aColor * light;
  if (uEmissive > 0.5) lit = aColor * 1.35 + vec3(0.12);
  vColor = lit;
  vec4 view = uView * world;
  float dist = -view.z;
  vFog = clamp((dist - uFogRange.x) / (uFogRange.y - uFogRange.x), 0.0, 1.0);
  gl_Position = uProj * view;
}
`;

export const FRAG_SRC = `
precision mediump float;
uniform vec3 uFogColor;
varying vec3 vColor;
varying float vFog;
void main() {
  gl_FragColor = vec4(mix(vColor, uFogColor, vFog), 1.0);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(sh));
  }
  return sh;
}

export function makeProgram(gl) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('program: ' + gl.getProgramInfoLog(prog));
  }
  const loc = (name) => gl.getUniformLocation(prog, name);
  return {
    prog,
    aPos: gl.getAttribLocation(prog, 'aPos'),
    aNormal: gl.getAttribLocation(prog, 'aNormal'),
    aColor: gl.getAttribLocation(prog, 'aColor'),
    uProj: loc('uProj'),
    uView: loc('uView'),
    uModel: loc('uModel'),
    uSunDir: loc('uSunDir'),
    uFogColor: loc('uFogColor'),
    uFogRange: loc('uFogRange'),
    uEmissive: loc('uEmissive'),
  };
}

// A mesh is one interleaved buffer: pos(3) normal(3) colour(3) per vertex,
// drawn as plain triangles. One draw call per mesh, no index buffer.
export function uploadMesh(gl, arrays) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrays), gl.STATIC_DRAW);
  return { buf, count: arrays.length / 9 };
}

export function drawMesh(gl, p, mesh, model, emissive) {
  gl.uniformMatrix4fv(p.uModel, false, model);
  gl.uniform1f(p.uEmissive, emissive ? 1 : 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
  const stride = 9 * 4;
  gl.enableVertexAttribArray(p.aPos);
  gl.vertexAttribPointer(p.aPos, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(p.aNormal);
  gl.vertexAttribPointer(p.aNormal, 3, gl.FLOAT, false, stride, 3 * 4);
  gl.enableVertexAttribArray(p.aColor);
  gl.vertexAttribPointer(p.aColor, 3, gl.FLOAT, false, stride, 6 * 4);
  gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}
