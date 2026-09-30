const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const movement = document.querySelector('.movement');
const plate = movement.querySelector('.movement__plate');
const plateImage = plate.querySelector('.plate__image');
const canvas = plate.querySelector('.movement__canvas');
const context = reduceMotion ? null : canvas.getContext('webgl2', { antialias: true });

const lifts = { rotor: 44, winding: 36, balance: 28, bridges: 20, pallets: 14, train: 7.5, plate: 0, dial: -10 };
const diameter = 37.2;
const frequency = 4;
const amplitude = (100 / 180) * Math.PI;
const palletStaff = [7.08, -7.805];

if (context) {
  movement.classList.add('movement--teardown');

  const loadObserver = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting) {
        loadObserver.disconnect();
        build();
      }
    },
    { rootMargin: '0px 0px 300% 0px' },
  );

  loadObserver.observe(movement);
} else if (!reduceMotion) {
  gsap.fromTo(
    plateImage,
    { '--reveal': '-12%' },
    { '--reveal': '100%', ease: 'none', scrollTrigger: { trigger: plate, start: 'top 85%', end: 'top 25%', scrub: true } },
  );
}

async function build() {
  const [THREE, { GLTFLoader }, { HDRLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three'),
    import('three/addons/loaders/GLTFLoader.js'),
    import('three/addons/loaders/HDRLoader.js'),
    import('three/addons/libs/meshopt_decoder.module.js'),
  ]);
  const desktop = matchMedia('(min-width: 900px)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, desktop ? 2 : 1.5));
  renderer.toneMapping = THREE.NeutralToneMapping;

  const materials = finishes(THREE, renderer, desktop);
  const [gltf, studio] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/movement.glb'),
    new HDRLoader().loadAsync('assets/studio.hdr'),
  ]);
  const parts = gltf.scene;
  studio.mapping = THREE.EquirectangularReflectionMapping;

  parts.traverse(object => {
    if (object.isMesh) object.material = materials[object.material.name];
  });
  parts.add(rotor(THREE, materials));
  parts.updateMatrixWorld();

  const centre = name => new THREE.Box3().setFromObject(parts.getObjectByName(name)).getCenter(new THREE.Vector3());
  const pivot = (name, x, y) => {
    const part = parts.getObjectByName(name);
    const axle = new THREE.Group();
    axle.position.set(x, y, 0);
    part.parent.add(axle);
    axle.attach(part);
    return axle;
  };

  const staff = centre('balanceWheel');
  const escapeCentre = centre('escapeWheel');
  const secondCentre = centre('secondWheel');
  const balance = pivot('balanceWheel', staff.x, staff.y);
  const hairspring = pivot('hairspring', staff.x, staff.y);
  const escapeWheel = pivot('escapeWheel', escapeCentre.x, escapeCentre.y);
  const secondWheel = pivot('secondWheel', secondCentre.x, secondCentre.y);
  const palletFork = pivot('palletFork', ...palletStaff);
  const balanceLayer = parts.getObjectByName('balance');

  const labels = [...plate.querySelectorAll('.movement__key li')].map(element => {
    const layer = parts.getObjectByName(element.dataset.layer);
    const box = new THREE.Box3().setFromObject(layer);
    return { element, layer, lift: lifts[element.dataset.layer], middle: (box.min.z + box.max.z) / 2, top: box.max.z, bottom: box.min.z };
  });
  const [top] = labels;
  const bottom = labels.at(-1);

  const model = new THREE.Group();
  model.rotation.x = -Math.PI / 2;
  model.add(parts);
  model.updateMatrixWorld();

  const scene = new THREE.Scene();
  scene.environment = studio;
  scene.add(model);

  const camera = new THREE.PerspectiveCamera(20, 1, 1, 2000);
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const target = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const back = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const point = new THREE.Vector3();
  const middle = new THREE.Vector3();
  const edge = new THREE.Vector3();
  const outline = Array.from({ length: 16 }, (_, i) => [Math.cos((i / 16) * Math.PI * 2) * (diameter / 2), Math.sin((i / 16) * Math.PI * 2) * (diameter / 2)]);
  const aside = desktop ? 0.14 : -0.14;
  const rest = desktop ? 0.12 : 0;
  const raise = desktop ? 0 : 0.08;
  const side = desktop ? -1 : 1;
  const view = { polar: 0.9, azimuth: -0.45, focus: 0, shift: rest, tilt: -0.5, turn: 0 };
  let width;
  let height;

  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    renderer.setSize(width, height, false);
  };

  resize();
  new ResizeObserver(resize).observe(canvas);

  const render = time => {
    const phase = time * frequency * Math.PI * 2;
    const beat = Math.floor(phase / Math.PI);
    const breath = 1 + 0.03 * Math.sin(phase);

    balance.rotation.z = amplitude * Math.sin(phase);
    hairspring.scale.set(breath, breath, 1);
    palletFork.rotation.z = beat % 2 ? 0.14 : -0.14;
    escapeWheel.rotation.z = -beat * (Math.PI / 15);
    secondWheel.rotation.z = -time * (Math.PI / 30);

    const stackTop = top.layer.position.z + top.top;
    const stackBottom = bottom.layer.position.z + bottom.bottom;
    const middleHeight = (stackTop + stackBottom) / 2;
    let fit = 0;

    back.setFromSphericalCoords(1, view.polar, Math.PI + view.azimuth);
    right.crossVectors(camera.up, back).normalize();
    up.crossVectors(back, right);

    for (const level of [stackTop, stackBottom]) {
      for (const [x, z] of outline) {
        point.set(x, level - middleHeight, z);
        const across = point.dot(right);
        const along = point.dot(up);
        fit = Math.max(
          fit,
          point.dot(back) + Math.abs(across) / (tan * (width / height) * (0.9 - Math.sign(across) * 2 * view.shift)),
          point.dot(back) + Math.abs(along) / (tan * (0.9 - Math.sign(along) * 2 * raise)),
        );
      }
    }

    focus.set(staff.x, staff.y, balanceLayer.position.z).applyMatrix4(model.matrixWorld);
    target.set(0, middleHeight, 0).lerp(focus, view.focus);
    camera.position.copy(back).multiplyScalar(THREE.MathUtils.lerp(fit, 62, view.focus)).add(target);
    camera.lookAt(target);
    scene.environmentRotation.set(view.tilt, view.turn, 0);
    camera.setViewOffset(width, height, -view.shift * width, raise * height, width, height);
    renderer.render(scene, camera);

    for (const label of labels) {
      middle.set(0, 0, label.layer.position.z + label.middle).applyMatrix4(model.matrixWorld);
      edge.copy(middle).addScaledVector(right, (side * diameter) / 2).project(camera);
      middle.project(camera);
      label.element.style.translate = `${((edge.x + 1) / 2) * width + side * 16}px ${((1 - middle.y) / 2) * height}px`;
    }
  };

  const timeline = gsap.timeline({
    defaults: { ease: 'power2.inOut' },
    scrollTrigger: { trigger: plate, start: 'top top', end: 'bottom bottom', scrub: 1 },
  });
  const beats = [...plate.querySelectorAll('.movement__beats li')];
  const show = (beat, at, until) => {
    timeline.fromTo(beat, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6 }, at);
    if (until) timeline.to(beat, { opacity: 0, duration: 0.4 }, until);
  };

  timeline
    .to(top.layer.position, { z: top.lift, duration: 1.8 }, 1)
    .to(view, { polar: 0.62, azimuth: -0.15, focus: 1, duration: 2.2 }, 1)
    .to(view, { tilt: 1, turn: 0.7, duration: 1.2 }, 1)
    .to(view, { focus: 0, duration: 1.4 }, 3.6)
    .to(view, { polar: 1.08, azimuth: 0.35, shift: aside, tilt: 0.5, turn: 0.3, duration: 2.6 }, 3.6)
    .to(view, { azimuth: 0.95, duration: 2.2, ease: 'sine.inOut' }, 6.2)
    .to(view, { polar: 0.95, azimuth: 0.6, shift: rest, tilt: -0.45, duration: 1.6 }, 8.4);

  labels.forEach((label, index) => {
    if (index) timeline.to(label.layer.position, { z: label.lift, duration: 1.6 }, 3.8 + (index - 1) * 0.35);
    timeline
      .to(label.element, { opacity: 1, duration: 0.6 }, 4.2 + index * 0.35)
      .to(label.layer.position, { z: 0, duration: 1.2 }, 8.4 + (labels.length - 1 - index) * 0.1);
  });

  timeline.to(
    labels.map(label => label.element),
    { opacity: 0, duration: 0.5 },
    8.2,
  );

  show(beats[0], 2.2, 3.6);
  show(beats[1], 4.6, 6.4);
  show(beats[2], 6.6, 8.2);
  show(beats[3], 8.8);

  timeline.to(top.layer.rotation, { z: -Math.PI * 4, duration: timeline.duration(), ease: 'none' }, 0);
  plateImage.querySelector('img').hidden = true;

  ScrollTrigger.create({
    trigger: plate,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: self => (self.isActive ? gsap.ticker.add(render) : gsap.ticker.remove(render)),
  });
}

function finishes(THREE, renderer, desktop) {
  const texture = direction => {
    let size = 256;
    let vectors = new Float32Array(size * size * 2);
    const mipmaps = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const [dx, dy, strength] = direction((x + 0.5) / size, (y + 0.5) / size);
        vectors.set([dx * strength, dy * strength], (y * size + x) * 2);
      }
    }

    while (size >= 1) {
      const data = new Uint8Array(size * size * 4);

      for (let i = 0; i < size * size; i++) {
        const length = Math.hypot(vectors[i * 2], vectors[i * 2 + 1]);
        const [dx, dy] = length > 0.01 ? [vectors[i * 2] / length, vectors[i * 2 + 1] / length] : [1, 0];
        data.set([(dx + 1) * 127.5, (dy + 1) * 127.5, Math.min(length, 1) * 255, 255], i * 4);
      }

      mipmaps.push({ data, width: size, height: size });
      if (size === 1) break;

      const half = size / 2;
      const next = new Float32Array(half * half * 2);

      for (let y = 0; y < half; y++) {
        for (let x = 0; x < half; x++) {
          for (let k = 0; k < 2; k++) {
            const at = (row, column) => vectors[(row * size + column) * 2 + k];
            next[(y * half + x) * 2 + k] = (at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1)) / 4;
          }
        }
      }

      vectors = next;
      size = half;
    }

    const map = new THREE.DataTexture(mipmaps[0].data, 256, 256);
    map.mipmaps = mipmaps;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.anisotropy = renderer.capabilities.getMaxAnisotropy();
    map.needsUpdate = true;
    return map;
  };

  const cotes = texture(u => {
    const across = ((u * 2) % 1) * 2 - 1;
    return [across / 3, Math.sqrt(3 ** 2 - across ** 2) / 3, 1];
  });

  const circular = texture((u, v) => {
    const radius = Math.hypot(u - 0.5, v - 0.5);
    return [(u - 0.5) / radius, (v - 0.5) / radius, Math.min(radius / 0.04, 1)];
  });

  const spots = [];

  for (let row = 0; row < 5; row++) {
    for (let column = 0; column < 4; column++) {
      spots.push([(column + (row % 2) / 2) / 4, (row + 0.5) / 5]);
    }
  }

  const perlage = texture((u, v) => {
    let last;

    for (const [x, y] of spots) {
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const dx = u - x - i;
          const dy = v - y - j;
          const radius = Math.hypot(dx, dy);

          if (radius < 0.175 && (!last || y + j > last.y || (y + j === last.y && x + i > last.x))) {
            last = { x: x + i, y: y + j, dx, dy, radius };
          }
        }
      }
    }

    return [last.dx / last.radius, last.dy / last.radius, Math.min(last.radius / 0.05, 1)];
  });

  cotes.repeat.setScalar(diameter / 4);
  perlage.repeat.setScalar(diameter / 4);

  const noise = new Float32Array(256 * 256);

  for (let octave = 0; octave < 4; octave++) {
    const cells = 8 << octave;
    const lattice = Float32Array.from({ length: cells * cells }, Math.random);
    const at = (i, j) => lattice[(j % cells) * cells + (i % cells)];

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const u = (x / 256) * cells;
        const v = (y / 256) * cells;
        const i = Math.floor(u);
        const j = Math.floor(v);
        const fu = (u - i) ** 2 * (3 - 2 * (u - i));
        const fv = (v - j) ** 2 * (3 - 2 * (v - j));
        const lower = THREE.MathUtils.lerp(at(i, j), at(i + 1, j), fu);
        const upper = THREE.MathUtils.lerp(at(i, j + 1), at(i + 1, j + 1), fu);
        noise[y * 256 + x] += THREE.MathUtils.lerp(lower, upper, fv) / 2 ** (octave + 1);
      }
    }
  }

  const height = (x, y) => noise[((y + 256) % 256) * 256 + ((x + 256) % 256)];
  const surface = (pixel, repeat) => {
    const data = new Uint8Array(256 * 256 * 4);

    for (let i = 0; i < 256 * 256; i++) data.set(pixel(i % 256, Math.floor(i / 256)), i * 4);

    const map = new THREE.DataTexture(data, 256, 256);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.repeat.setScalar(repeat);
    map.needsUpdate = true;
    return map;
  };

  const tiled = (map, repeat) => {
    const copy = map.clone();
    copy.repeat.setScalar(repeat);
    return copy;
  };

  const mottle = surface((x, y) => [0, 115 + 140 * height(x, y), 0, 255], 1);
  const frost = surface((x, y) => {
    const normal = new THREE.Vector3((height(x - 1, y) - height(x + 1, y)) * 8, (height(x, y - 1) - height(x, y + 1)) * 8, 1).normalize();
    return [(normal.x + 1) * 127.5, (normal.y + 1) * 127.5, (normal.z + 1) * 127.5, 255];
  }, 0.9);
  const movementMottle = tiled(mottle, diameter / 10);
  const movementFrost = tiled(frost, diameter * 0.9);
  const rotorMottle = tiled(mottle, 0.12);

  const metal = (color, roughness, maps = {}) =>
    maps.anisotropyMap
      ? new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness, ...maps })
      : new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, ...maps });

  return {
    bridge: metal(0xdcdcdf, 0.34, { anisotropyMap: cotes, anisotropy: 0.45, roughnessMap: movementMottle, normalMap: movementFrost, normalScale: new THREE.Vector2(0.12, 0.12) }),
    plate: metal(0xd2d2d6, 0.38, { anisotropyMap: perlage, anisotropy: 0.4, roughnessMap: movementMottle, normalMap: movementFrost, normalScale: new THREE.Vector2(0.12, 0.12) }),
    rhodium: metal(0xdcdcdf, 0.1),
    gold: metal(0xf2cf92, 0.32, { anisotropyMap: circular, anisotropy: 0.7, roughnessMap: mottle }),
    polishedGold: metal(0xf2cf92, 0.12),
    soleil: metal(0xb9babd, 0.24, { anisotropyMap: circular, anisotropy: 0.8, roughnessMap: mottle }),
    steel: metal(0xcacbce, 0.08),
    pinkGold: metal(0xf1c6b0, 0.22),
    satinPinkGold: metal(0xf1c6b0, 0.4, { normalMap: frost, normalScale: new THREE.Vector2(0.3, 0.3), roughnessMap: rotorMottle }),
    spring: metal(0x3c3e44, 0.3),
    inlay: metal(0x0a4a2a, 0.45, { normalMap: frost, normalScale: new THREE.Vector2(0.45, 0.45), roughnessMap: rotorMottle }),
    jewel: new THREE.MeshPhysicalMaterial({
      color: 0xd11a4d,
      roughness: 0.05,
      ior: 1.76,
      transmission: desktop ? 1 : 0,
      thickness: 0.4,
      attenuationColor: 0xd11a4d,
      attenuationDistance: 0.5,
    }),
  };
}

function rotor(THREE, materials) {
  const half = Math.PI / 12;
  const spoke = 0.4;
  const bar = 0.4;
  const chevrons = [
    [6.2, 8.4],
    [9.4, 11.6],
    [12.6, 14.8],
  ];

  const edge = (radius, side) =>
    new THREE.Vector2(radius * Math.cos(half) + spoke * Math.sin(half), side * (radius * Math.sin(half) - spoke * Math.cos(half)));
  const middle = radius => new THREE.Vector2(radius, 0);
  const arc = (radius, from) => {
    const end = edge(radius, 1).angle();
    return Array.from({ length: 9 }, (_, i) => {
      const angle = from * end * (1 - i / 4);
      return new THREE.Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
    });
  };
  const band = ([innerMiddle, innerEdge], [outerMiddle, outerEdge]) => [
    edge(innerEdge + bar, -1),
    middle(innerMiddle + bar),
    edge(innerEdge + bar, 1),
    edge(outerEdge - bar, 1),
    middle(outerMiddle - bar),
    edge(outerEdge - bar, -1),
  ];

  const [[firstMiddle, firstEdge], , [lastMiddle, lastEdge]] = chevrons;
  const openings = [
    [...arc(4.4, -1), edge(firstEdge - bar, 1), middle(firstMiddle - bar), edge(firstEdge - bar, -1)],
    band(chevrons[0], chevrons[1]),
    band(chevrons[1], chevrons[2]),
  ];
  const pane = [edge(lastEdge + bar, -1), middle(lastMiddle + bar), edge(lastEdge + bar, 1), ...arc(16.4, 1)];

  const frame = new THREE.Shape().absarc(0, 0, 18, 0, Math.PI * 2);
  const panes = [];
  frame.holes.push(new THREE.Path().absarc(0, 0, 3.3, 0, Math.PI * 2, true));

  for (let sector = 0; sector < 12; sector++) {
    const turn = points => points.map(point => point.clone().rotateAround(new THREE.Vector2(), sector * half * 2));

    for (const opening of openings) frame.holes.push(new THREE.Path(turn(opening)));
    frame.holes.push(new THREE.Path(turn(pane)));
    panes.push(new THREE.Shape(turn(pane)));
  }

  const group = new THREE.Group();
  group.name = 'rotor';

  const weight = new THREE.Mesh(
    new THREE.ExtrudeGeometry(frame, { depth: 0.6, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 3, curveSegments: 48 }),
    [materials.satinPinkGold, materials.pinkGold],
  );
  weight.position.z = 2.45;

  const glass = new THREE.Mesh(new THREE.ExtrudeGeometry(panes, { depth: 0.3, bevelEnabled: false }), materials.inlay);
  glass.position.z = 2.7;

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 0.5, 64), materials.soleil);
  hub.rotation.x = Math.PI / 2;
  hub.position.z = 2.75;

  const jewel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 32), materials.jewel);
  jewel.rotation.x = Math.PI / 2;
  jewel.position.z = 3.05;

  group.add(weight, glass, hub, jewel);

  const screwHead = new THREE.CylinderGeometry(0.42, 0.42, 0.2, 32);
  const screwSlot = new THREE.BoxGeometry(0.84, 0.1, 0.08);

  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + (i * Math.PI * 2) / 3;
    const screw = new THREE.Mesh(screwHead, materials.steel);
    const slot = new THREE.Mesh(screwSlot, materials.spring);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(Math.cos(angle) * 1.7, Math.sin(angle) * 1.7, 3.1);
    slot.position.set(screw.position.x, screw.position.y, 3.19);
    slot.rotation.z = angle + i;
    group.add(screw, slot);
  }

  return group;
}
