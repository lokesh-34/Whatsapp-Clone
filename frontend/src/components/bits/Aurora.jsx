/**
 * React Bits — Aurora Background
 * https://www.reactbits.dev/backgrounds/aurora
 * WebGL animated aurora borealis background
 */
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl'
import { useEffect, useRef } from 'react'

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

#define COLOR_RAMP(colors, factor, finalColor) \
  int index = 0; \
  for (int i = 0; i < 2; i++) { \
    bool isInBetween = colors[i].y <= factor; \
    index = int(mix(float(index), float(i), float(isInBetween))); \
  } \
  float range2 = colors[index + 1].y - colors[index].y; \
  float lerpFactor = (factor - colors[index].y) / range2; \
  finalColor = mix(colors[index].xyz, colors[index + 1].xyz, lerpFactor);

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  vec4 colorStops[3];
  colorStops[0] = vec4(uColorStops[0], 0.0);
  colorStops[1] = vec4(uColorStops[1], 0.5);
  colorStops[2] = vec4(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colorStops, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);
  vec3 auroraColor = intensity * rampColor;
  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);
}
`

export default function Aurora({
  colorStops = ['#003d2e', '#00A884', '#003d2e'],
  amplitude = 1.0,
  blend = 0.5,
  speed = 1.0,
}) {
  const propsRef = useRef({ colorStops, amplitude, blend, speed })
  propsRef.current = { colorStops, amplitude, blend, speed }
  const ctnDom = useRef(null)

  useEffect(() => {
    const ctn = ctnDom.current
    if (!ctn) return

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    gl.canvas.style.backgroundColor = 'transparent'

    let program
    const resize = () => {
      if (!ctn) return
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight)
      if (program) program.uniforms.uResolution.value = [ctn.offsetWidth, ctn.offsetHeight]
    }
    window.addEventListener('resize', resize)

    const geometry = new Triangle(gl)
    if (geometry.attributes.uv) delete geometry.attributes.uv

    const toColorArr = (stops) => stops.map(hex => { const c = new Color(hex); return [c.r, c.g, c.b] })

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime:       { value: 0 },
        uAmplitude:  { value: amplitude },
        uColorStops: { value: toColorArr(colorStops) },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uBlend:      { value: blend },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })
    ctn.appendChild(gl.canvas)

    let animId = 0
    const update = (t) => {
      animId = requestAnimationFrame(update)
      const p = propsRef.current
      program.uniforms.uTime.value = t * 0.001 * (p.speed ?? 1)
      program.uniforms.uAmplitude.value = p.amplitude ?? 1
      program.uniforms.uBlend.value = p.blend ?? 0.5
      program.uniforms.uColorStops.value = toColorArr(p.colorStops ?? colorStops)
      renderer.render({ scene: mesh })
    }
    animId = requestAnimationFrame(update)
    resize()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      if (ctn && gl.canvas.parentNode === ctn) ctn.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={ctnDom}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
