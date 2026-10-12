const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const tray = document.querySelector('.tray');
const canvas = tray.querySelector('.tray__canvas');
const items = [...tray.querySelectorAll('li')];
const gl = reduceMotion ? null : canvas.getContext('webgl2', { antialias: false, depth: false });

const finishes = {
  crystallium: { tint: [0.12, 0.5, 0.2], metal: 0.85, rough: 0.03, clear: 0, facets: 15 },
  'pink-gold': { tint: [0.88, 0.56, 0.43], metal: 1, rough: 0.03, clear: 0, facets: 0 },
  'polished-glass': { tint: [0.04, 0.2, 0.08], metal: 0.05, rough: 0.01, clear: 0, facets: 0 },
  'shot-blasted-glass': { tint: [0.07, 0.17, 0.09], metal: 0.05, rough: 0.5, clear: 0, facets: 0 },
  'transparent-glass': { tint: [0.92, 0.97, 0.95], metal: 0, rough: 0.01, clear: 1, facets: 0 },
  'green-glass': { tint: [0.01, 0.45, 0.1], metal: 0.05, rough: 0.01, clear: 0.9, facets: 0 },
};

if (gl) {
  tray.classList.add('tray--lit');

  const loadObserver = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting) {
        loadObserver.disconnect();
        build();
      }
    },
    { rootMargin: '0px 0px 300% 0px' },
  );

  loadObserver.observe(tray);
}

function build() {
  const desktop = matchMedia('(min-width: 900px)').matches;
  const vertex = `#version 300 es
    void main() {
      gl_Position = vec4(vec2(gl_VertexID % 2, gl_VertexID / 2) * 4.0 - 1.0, 0.0, 1.0);
    }`;
  const fragment = `#version 300 es
    precision highp float;

    uniform vec2 centres[${items.length}];
    uniform vec3 tints[${items.length}];
    uniform vec4 materials[${items.length}];
    uniform float radius;
    uniform vec2 lamp;
    uniform vec2 reach;
    uniform vec2 size;
    out vec4 pixel;

    const vec3 white = vec3(1.0, 0.97, 0.93);
    const vec3 felt = vec3(0.008, 0.014, 0.011);
    const vec2 slant = vec2(0.5, 0.8660254);

    vec2 hash(vec2 p) {
      uvec2 q = uvec2(ivec2(floor(p)));
      q = 1103515245u * ((q >> 1u) ^ q.yx);
      return vec2(1103515245u * (q ^ (q.yx >> 3u))) / 4294967295.0;
    }

    float erf(float x) {
      x = clamp(x, -3.0, 3.0);
      return tanh(x * (1.128379 + 0.1028 * x * x));
    }

    float band(float x, float extent, float blur) {
      return 0.5 * (erf((extent - x) / blur) + erf((extent + x) / blur));
    }

    float glare(vec2 hit, vec2 blur) {
      return 12.0 * band(hit.x, reach.x, blur.x) * band(hit.y, reach.y, blur.y)
        + 0.5 * band(hit.x, reach.x * 3.0, blur.x + radius * 0.3) * band(hit.y, reach.y, blur.y + radius * 0.3);
    }

    float lit(vec2 p, vec3 normal, float height) {
      vec3 toward = vec3(lamp + clamp(p - lamp, -reach, reach) - p, height);
      return max(dot(normal, normalize(toward)), 0.0) * height * height / dot(toward, toward);
    }

    vec3 pool(vec2 p, float height) {
      vec2 away = p - lamp - clamp(p - lamp, -reach, reach);
      return white * felt * pow(height * height / (dot(away, away) + height * height), 3.0);
    }

    vec3 tone(vec3 color) {
      float peak = max(color.r, max(color.g, color.b));
      if (peak < 0.76) return color;
      float compressed = 1.0 - 0.0576 / (peak - 0.52);
      return mix(color * compressed / peak, vec3(compressed), 1.0 - 1.0 / (0.15 * (peak - compressed) + 1.0));
    }

    void main() {
      vec2 p = vec2(gl_FragCoord.x, size.y - gl_FragCoord.y);
      int k = 0;
      float edge = size.x;

      for (int i = 0; i < ${items.length}; i++) {
        vec2 a = abs(p - centres[i]);
        float e = max(a.x, dot(a, slant)) - radius * slant.y;

        if (e < edge) {
          edge = e;
          k = i;
        }
      }

      vec2 local = p - centres[k];
      vec2 a = abs(local);
      vec2 outward = sign(local) * (a.x > dot(a, slant) ? vec2(1.0, 0.0) : slant);
      float bevel = clamp(1.0 + edge / (radius * 0.04), 0.0, 1.0);
      float tilt = asin(bevel * 0.7);
      vec3 normal = vec3(outward * sin(tilt), cos(tilt));
      float height = radius * 1.2;
      vec3 ray = reflect(vec3(0.0, 0.0, -1.0), normal);
      vec2 footprint = fwidth(p + ray.xy * height / max(ray.z, 0.01)) + 0.5;
      vec3 tint = tints[k];
      float metal = materials[k].x;
      float rough = materials[k].y;
      float clear = materials[k].z;
      float facets = materials[k].w;
      float crease = 1.0;

      if (facets > 0.0) {
        vec2 cell = local * facets / radius;
        vec2 nearest;
        float first = 9.0;
        float second = 9.0;

        for (int j = -1; j <= 1; j++) {
          for (int i = -1; i <= 1; i++) {
            vec2 seed = floor(cell) + vec2(i, j);
            float d = distance(cell, seed + hash(seed));

            if (d < first) {
              second = first;
              first = d;
              nearest = seed;
            } else {
              second = min(second, d);
            }
          }
        }

        normal = normalize(vec3(normal.xy + (hash(nearest + 17.0) - 0.5) * 0.7 * normal.z, normal.z));
        tint *= 0.1 + pow(hash(nearest + 31.0).x, 3.0) * 2.0;
        crease = smoothstep(0.0, 0.8 * facets / radius, second - first);
      }

      normal = normalize(vec3(normal.xy + (hash(local / radius * 160.0) - 0.5) * rough * rough, normal.z));
      ray = reflect(vec3(0.0, 0.0, -1.0), normal);

      float travel = height / max(ray.z, 0.01);
      vec2 hit = p + ray.xy * travel - lamp;
      float mirror = step(0.0, ray.z) * glare(hit, rough * travel + footprint);

      vec3 f0 = mix(vec3(0.04), tint, metal);
      vec3 fresnel = mix(f0 + (1.0 - f0) * pow(1.0 - normal.z, 5.0), vec3(1.0), clear * smoothstep(0.0, 0.5, bevel) * 0.6);
      vec3 specular = (white * mirror + 0.02 * max(ray.z, 0.0)) * fresnel * crease;
      vec3 body = tint * (0.06 + lit(p, normal, height) + 0.25 * glare(hit, (0.2 + rough) * travel + footprint)) * (1.0 - metal) * (1.0 - clear) * crease;
      vec3 seen = pool(p + normal.xy * radius * 0.4, height) * tint * tint + tint * bevel * lit(p, vec3(0.0, 0.0, 1.0), height);

      vec3 coupon = pow(tone(specular + body + seen * clear), vec3(1.0 / 2.2));
      vec3 ground = pow(pool(p, height), vec3(1.0 / 2.2)) * smoothstep(0.0, radius, min(min(p.x, size.x - p.x), min(p.y, size.y - p.y)));
      float cover = clamp(0.5 - edge, 0.0, 1.0);
      vec3 color = mix(ground, coupon, cover) + (hash(gl_FragCoord.xy).x - 0.5) / 255.0;
      pixel = vec4(color, max((1.0 - clear) * cover, max(color.r, max(color.g, color.b))));
    }`;

  const program = gl.createProgram();

  for (const [type, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }

  gl.linkProgram(program);
  gl.useProgram(program);

  const uniform = name => gl.getUniformLocation(program, name);
  const lamp = uniform('lamp');
  const sweep = { progress: 0 };
  let from;
  let to;

  gl.uniform3fv(uniform('tints'), items.flatMap(item => finishes[item.dataset.finish].tint));
  gl.uniform4fv(
    uniform('materials'),
    items.flatMap(item => {
      const { metal, rough, clear, facets } = finishes[item.dataset.finish];
      return [metal, rough, clear, facets];
    }),
  );

  const render = () => {
    gl.uniform2fv(lamp, gsap.utils.interpolate(from, to, sweep.progress));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    const frame = canvas.getBoundingClientRect();
    const radius = (items[0].clientWidth / Math.sqrt(3)) * devicePixelRatio;
    const centres = items.map(item => {
      const box = item.getBoundingClientRect();
      return [(box.left + box.width / 2 - frame.left) * devicePixelRatio, (box.top - frame.top) * devicePixelRatio + radius];
    });
    const first = centres[0];
    const last = centres.at(-1);
    const middle = gsap.utils.interpolate(first, last, 0.5);

    canvas.width = frame.width * devicePixelRatio;
    canvas.height = frame.height * devicePixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniform('size'), canvas.width, canvas.height);
    gl.uniform2fv(uniform('centres'), centres.flat());
    gl.uniform1f(uniform('radius'), radius);
    gl.uniform2fv(uniform('reach'), desktop ? [radius * 0.1, radius * 1.2] : [last[0] - middle[0] + radius * 1.2, radius * 0.1]);
    from = desktop ? [first[0] - radius * 2, middle[1]] : [middle[0], first[1] - radius * 2];
    to = desktop ? [last[0] + radius * 2, middle[1]] : [middle[0], last[1] + radius * 2];
    render();
  };

  resize();
  new ResizeObserver(resize).observe(canvas);

  gsap.to(sweep, {
    progress: 1,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: { trigger: tray, start: desktop ? 'center 90%' : 'top 60%', end: desktop ? 'center 30%' : 'bottom 60%', scrub: true },
  });
}
