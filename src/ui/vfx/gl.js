// The WebGL renderer for the effects layer (no libraries). Each frame:
//   1. every sprite, ribbon and quad, batched, into a scene texture (alpha-
//      blended ones first, then additive light), premultiplied alpha;
//   2. distortion sprites (shockwaves, heat) into a small offset map;
//   3. bloom: the bright parts, downsampled and blurred (two passes);
//   4. composite onto the canvas: the scene sampled through the distortion,
//      plus bloom, dimmed over "keep out" rectangles (numbers stay readable).
// The canvas is transparent: additive light adds to the board under it.

const MAX_QUADS = 6000;
const FLOATS = 9;   // x, y, u, v, r, g, b, a, additive

const SPRITE_VS = `
attribute vec2 aPos; attribute vec2 aUV; attribute vec4 aCol; attribute float aAdd;
uniform vec2 uRes;
varying vec2 vUV; varying vec4 vCol; varying float vAdd;
void main() {
  vUV = aUV; vCol = aCol; vAdd = aAdd;
  vec2 p = aPos / uRes * 2.0 - 1.0;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
}`;
const SPRITE_FS = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUV; varying vec4 vCol; varying float vAdd;
void main() {
  vec4 t = texture2D(uTex, vUV);
  gl_FragColor = vec4(t.rgb * vCol.rgb * vCol.a, t.a * vCol.a * (1.0 - vAdd));
}`;
const DISTORT_FS = `
precision mediump float;
uniform sampler2D uTex;
varying vec2 vUV; varying vec4 vCol; varying float vAdd;
void main() {
  vec4 t = texture2D(uTex, vUV);
  gl_FragColor = vec4(t.rg, 0.0, t.a * vCol.a);
}`;
const FULL_VS = `
attribute vec2 aPos;
varying vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const BRIGHT_FS = `
precision mediump float;
uniform sampler2D uSrc; uniform vec2 uTexel;
varying vec2 vUV;
vec3 bright(vec2 uv) {
  vec3 c = texture2D(uSrc, uv).rgb;
  float l = max(c.r, max(c.g, c.b));
  return c * smoothstep(0.3, 0.85, l);
}
void main() {
  vec3 c = bright(vUV + uTexel * vec2(-1.0, -1.0)) + bright(vUV + uTexel * vec2(1.0, -1.0))
         + bright(vUV + uTexel * vec2(-1.0, 1.0)) + bright(vUV + uTexel * vec2(1.0, 1.0));
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;
const BLUR_FS = `
precision mediump float;
uniform sampler2D uSrc; uniform vec2 uDir;
varying vec2 vUV;
void main() {
  vec3 c = texture2D(uSrc, vUV).rgb * 0.227;
  c += texture2D(uSrc, vUV + uDir * 1.385).rgb * 0.316;
  c += texture2D(uSrc, vUV - uDir * 1.385).rgb * 0.316;
  c += texture2D(uSrc, vUV + uDir * 3.231).rgb * 0.07;
  c += texture2D(uSrc, vUV - uDir * 3.231).rgb * 0.07;
  gl_FragColor = vec4(c, 1.0);
}`;
const COMPOSITE_FS = `
precision mediump float;
uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uDist;
uniform float uBloomAmt; uniform float uDistAmt;
uniform vec4 uKeep[8]; uniform int uKeepN;
varying vec2 vUV;
void main() {
  vec2 d = (texture2D(uDist, vUV).rg - 0.5) * uDistAmt;
  vec4 s = texture2D(uScene, vUV + d);
  vec3 b = texture2D(uBloom, vUV).rgb * uBloomAmt;
  float keep = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= uKeepN) break;
    vec4 r = uKeep[i];
    if (vUV.x > r.x && vUV.x < r.z && vUV.y > r.y && vUV.y < r.w) keep = 0.18;
  }
  gl_FragColor = vec4((s.rgb + b) * keep, s.a * keep);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, vs, fs, attribs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  attribs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const uni = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    uni[name] = gl.getUniformLocation(p, name);
  }
  return { p, uni };
}

function target(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}

// A renderer on `canvas`, or null if WebGL isn't available.
export function createRenderer(canvas) {
  let gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const W = canvas.width;
  const H = canvas.height;
  let sprite;
  let distortP;
  let bright;
  let blur;
  let composite;
  try {
    const attribs = ['aPos', 'aUV', 'aCol', 'aAdd'];
    sprite = program(gl, SPRITE_VS, SPRITE_FS, attribs);
    distortP = program(gl, SPRITE_VS, DISTORT_FS, attribs);
    bright = program(gl, FULL_VS, BRIGHT_FS, ['aPos']);
    blur = program(gl, FULL_VS, BLUR_FS, ['aPos']);
    composite = program(gl, FULL_VS, COMPOSITE_FS, ['aPos']);
  } catch (err) {
    console.warn('VFX: WebGL shaders failed, using the 2D effects.', err);
    return null;
  }
  const scene = target(gl, W, H);
  const dist = target(gl, W >> 2, H >> 2);
  const bloomA = target(gl, W >> 2, H >> 2);
  const bloomB = target(gl, W >> 2, H >> 2);

  const vbo = gl.createBuffer();
  const data = new Float32Array(MAX_QUADS * 4 * FLOATS);
  const ibo = gl.createBuffer();
  const idx = new Uint16Array(MAX_QUADS * 6);
  for (let q = 0; q < MAX_QUADS; q++) idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  const full = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, full);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const textures = {};   // name → { tex, w, h }

  function upload(name, image, { premultiply = true } = {}) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    textures[name] = { tex, w: image.width, h: image.height };
  }

  function bindSpriteAttribs() {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const stride = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32);
  }
  function bindFull() {
    gl.bindBuffer(gl.ARRAY_BUFFER, full);
    for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
  }

  // quads: [{ tex, p: [x0,y0, x1,y1, x2,y2, x3,y3], uv: [u0,v0,u1,v1], c: [r,g,b,a], add }]
  function drawQuads(quads, prog) {
    if (!quads.length) return;
    const n = Math.min(quads.length, MAX_QUADS);
    let o = 0;
    for (let q = 0; q < n; q++) {
      const { p, uv, c, add } = quads[q];
      const corners = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
      for (let k = 0; k < 4; k++) {
        data[o++] = p[k * 2]; data[o++] = p[k * 2 + 1];
        data[o++] = corners[k][0]; data[o++] = corners[k][1];
        data[o++] = c[0]; data[o++] = c[1]; data[o++] = c[2]; data[o++] = c[3];
        data[o++] = add ? 1 : 0;
      }
    }
    gl.useProgram(prog.p);
    gl.uniform2f(prog.uni.uRes, W, H);
    gl.uniform1i(prog.uni.uTex, 0);
    bindSpriteAttribs();
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, o));
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.activeTexture(gl.TEXTURE0);
    // One draw call per run of quads that share a texture.
    let start = 0;
    for (let q = 1; q <= n; q++) {
      if (q === n || quads[q].tex !== quads[start].tex) {
        const t = textures[quads[start].tex] ?? textures.dot;
        gl.bindTexture(gl.TEXTURE_2D, t.tex);
        gl.drawElements(gl.TRIANGLES, (q - start) * 6, gl.UNSIGNED_SHORT, start * 6 * 2);
        start = q;
      }
    }
  }

  function pass(prog, dst, setup) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst?.fb ?? null);
    gl.viewport(0, 0, dst?.w ?? W, dst?.h ?? H);
    gl.useProgram(prog.p);
    setup();
    bindFull();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function bindTex(unit, tex, uniform) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(uniform, unit);
  }

  // One frame. quads: scene sprites, already in draw order (alpha first, then additive).
  // distort: distortion quads. bloom: 0..2. distortAmount: max uv push. keep: [x, y, w, h] stage px.
  function render({ quads, distort = [], bloom = 1, distortAmount = 0.02, keep = [] }) {
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // 1. Scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    drawQuads(quads, sprite);
    // 2. Distortion map
    gl.bindFramebuffer(gl.FRAMEBUFFER, dist.fb);
    gl.viewport(0, 0, dist.w, dist.h);
    gl.clearColor(0.5, 0.5, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (distort.length) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      drawQuads(distort, distortP);
    }
    gl.disable(gl.BLEND);
    // 3. Bloom
    if (bloom > 0) {
      pass(bright, bloomA, () => { bindTex(0, scene.tex, bright.uni.uSrc); gl.uniform2f(bright.uni.uTexel, 1 / W, 1 / H); });
      for (let i = 0; i < 2; i++) {
        pass(blur, bloomB, () => { bindTex(0, bloomA.tex, blur.uni.uSrc); gl.uniform2f(blur.uni.uDir, 1 / bloomA.w, 0); });
        pass(blur, bloomA, () => { bindTex(0, bloomB.tex, blur.uni.uSrc); gl.uniform2f(blur.uni.uDir, 0, 1 / bloomA.h); });
      }
    }
    // 4. Composite
    gl.clearColor(0, 0, 0, 0);
    pass(composite, null, () => {
      gl.clear(gl.COLOR_BUFFER_BIT);
      bindTex(0, scene.tex, composite.uni.uScene);
      bindTex(1, bloomA.tex, composite.uni.uBloom);
      bindTex(2, dist.tex, composite.uni.uDist);
      gl.uniform1f(composite.uni.uBloomAmt, bloom);
      gl.uniform1f(composite.uni.uDistAmt, distortAmount);
      const rects = new Float32Array(32);
      const n = Math.min(8, keep.length);
      for (let i = 0; i < n; i++) {
        const [x, y, w, h] = keep[i];
        rects.set([x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H], i * 4);
      }
      gl.uniform4fv(composite.uni.uKeep, rects);
      gl.uniform1i(composite.uni.uKeepN, n);
    });
  }

  function clear() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  return { upload, render, clear, textures, width: W, height: H, lost: () => gl.isContextLost() };
}
