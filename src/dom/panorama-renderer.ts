import type { PanoramaPose } from "../core/model.js";

const vertexSource = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;
const fragmentSource = `
precision highp float;
uniform samplerCube panorama;
uniform vec2 tangents;
uniform vec4 angles;
varying vec2 uv;
void main() {
  vec2 q = (uv * 2.0 - 1.0) * vec2(tangents.x, -tangents.y);
  vec3 ray = vec3(q.x, -(angles.x * q.y + angles.y), angles.x - angles.y * q.y);
  vec3 direction = vec3(
    angles.z * ray.x - angles.w * ray.z,
    ray.y,
    angles.w * ray.x + angles.z * ray.z
  );
  gl_FragColor = textureCube(panorama, direction);
}`;

interface Texture {
  value: WebGLTexture;
  references: number;
}
interface Pool {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  angles: WebGLUniformLocation;
  tangents: WebGLUniformLocation;
  limit: number;
  references: number;
  lost: boolean;
  textures: Map<string, Texture>;
  listeners: Set<() => void>;
  dispose(): void;
}

// Rows share the GPU context, while their output canvases and clocks stay independent.
const pools = new WeakMap<Document, Pool>();

function createPool(doc: Document): Pool | null {
  const canvas = doc.createElement("canvas"),
    gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
  if (!gl) return null;
  let program: WebGLProgram | null = null,
    buffer: WebGLBuffer | null = null;
  const shaders: WebGLShader[] = [];
  try {
    for (const [kind, source] of [
      [gl.VERTEX_SHADER, vertexSource],
      [gl.FRAGMENT_SHADER, fragmentSource],
    ] as const) {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error("Panorama shader allocation failed");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error("Panorama shader compilation failed");
    }
    program = gl.createProgram();
    buffer = gl.createBuffer();
    if (!program || !buffer) throw new Error("Panorama allocation failed");
    for (const shader of shaders) gl.attachShader(program, shader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
      throw new Error("Panorama program link failed");
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, "position"),
      angles = gl.getUniformLocation(program, "angles"),
      tangents = gl.getUniformLocation(program, "tangents");
    if (position < 0 || !angles || !tangents)
      throw new Error("Panorama shader inputs unavailable");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(gl.getUniformLocation(program, "panorama"), 0);
    const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;
    const pool: Pool = {
      canvas,
      gl,
      program,
      angles,
      tangents,
      limit: Math.min(4096, viewport[0]!, viewport[1]!),
      references: 0,
      lost: false,
      textures: new Map(),
      listeners: new Set(),
      dispose() {
        canvas.removeEventListener("webglcontextlost", lost);
        for (const texture of pool.textures.values())
          gl.deleteTexture(texture.value);
        pool.textures.clear();
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        if (pools.get(doc) === pool) pools.delete(doc);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      },
    };
    const lost = () => {
      pool.lost = true;
      if (pools.get(doc) === pool) pools.delete(doc);
      for (const listener of [...pool.listeners]) listener();
    };
    canvas.addEventListener("webglcontextlost", lost);
    return pool;
  } catch {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
}

/** No image readback: same-origin or CORS-authorized faces become a shared cubemap. */
export function createPanoramaSurface(
  doc: Document,
  images: HTMLImageElement[],
  urls: readonly string[],
  onLost: () => void,
) {
  const canvas = doc.createElement("canvas"),
    context = canvas.getContext("2d");
  if (!context) return null;
  let pool = pools.get(doc);
  if (!pool) {
    pool = createPool(doc) ?? undefined;
    if (!pool) return null;
    pools.set(doc, pool);
  }
  const renderer = pool,
    key = JSON.stringify(urls);
  let texture = renderer.textures.get(key);
  if (!texture) {
    const gl = renderer.gl,
      value = gl.createTexture();
    try {
      if (!value) throw new Error("Panorama texture allocation failed");
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, value);
      // Native front/right/back/left/top/bottom to GL +X/-X/+Y/-Y/+Z/-Z.
      [1, 3, 4, 5, 0, 2].forEach((face, index) =>
        gl.texImage2D(
          gl.TEXTURE_CUBE_MAP_POSITIVE_X + index,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          images[face]!,
        ),
      );
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(
        gl.TEXTURE_CUBE_MAP,
        gl.TEXTURE_WRAP_S,
        gl.CLAMP_TO_EDGE,
      );
      gl.texParameteri(
        gl.TEXTURE_CUBE_MAP,
        gl.TEXTURE_WRAP_T,
        gl.CLAMP_TO_EDGE,
      );
      if (gl.getError() !== gl.NO_ERROR)
        throw new Error("Panorama texture upload failed");
      texture = { value, references: 0 };
      renderer.textures.set(key, texture);
    } catch {
      gl.deleteTexture(value);
      if (!renderer.references) renderer.dispose();
      return null;
    }
  }
  const resource = texture;
  renderer.references++;
  resource.references++;
  renderer.listeners.add(onLost);
  let destroyed = false;
  return {
    canvas,
    draw(
      pose: PanoramaPose,
      width: number,
      height: number,
      scale: number,
      blur: number,
    ) {
      const extra = blur * 6,
        fullWidth = width + extra,
        fullHeight = height + extra,
        requestedWidth = fullWidth * scale,
        requestedHeight = fullHeight * scale;
      if (
        destroyed ||
        renderer.lost ||
        renderer.gl.isContextLost() ||
        !Number.isFinite(requestedWidth + requestedHeight) ||
        width <= 0 ||
        height <= 0
      )
        return false;
      const factor = Math.min(
          1,
          renderer.limit / requestedWidth,
          renderer.limit / requestedHeight,
        ),
        w = Math.max(1, Math.round(requestedWidth * factor)),
        h = Math.max(1, Math.round(requestedHeight * factor)),
        gl = renderer.gl;
      if (renderer.canvas.width < w) renderer.canvas.width = w;
      if (renderer.canvas.height < h) renderer.canvas.height = h;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const pitch = (pose.pitch * Math.PI) / 180,
        yaw = (pose.yaw * Math.PI) / 180,
        tangent = Math.tan((pose.verticalFov * Math.PI) / 360);
      gl.viewport(0, 0, w, h);
      gl.useProgram(renderer.program);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, resource.value);
      gl.uniform4f(
        renderer.angles,
        Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw),
        Math.sin(yaw),
      );
      gl.uniform2f(
        renderer.tangents,
        (tangent * fullWidth) / height,
        (tangent * fullHeight) / height,
      );
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      context.globalCompositeOperation = "copy";
      context.drawImage(
        renderer.canvas,
        0,
        renderer.canvas.height - h,
        w,
        h,
        0,
        0,
        w,
        h,
      );
      canvas.dataset.panoramaYaw = String(pose.yaw);
      return true;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      renderer.listeners.delete(onLost);
      if (!--resource.references) {
        renderer.gl.deleteTexture(resource.value);
        renderer.textures.delete(key);
      }
      if (!--renderer.references) renderer.dispose();
    },
  };
}
