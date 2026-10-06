import * as THREE from 'three';

/** A walkable terrain mesh for a height function, checkered in 1 m cells so motion reads. */
export function terrainMesh(
  height: (x: number, z: number) => number,
  size = 48,
  segments = 192,
): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const light = new THREE.Color('#4a515c');
  const dark = new THREE.Color('#3d434d');
  const tint = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const y = height(x, z);
    position.setY(i, y);
    const checker = (Math.floor(x) + Math.floor(z)) & 1;
    tint.copy(checker ? light : dark).offsetHSL(0, 0, y * 0.08);
    tint.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

/** Expanding rings where feet land: a small pool, reused. */
export class FootstepRings {
  readonly group = new THREE.Group();
  private readonly rings: { mesh: THREE.Mesh; age: number; size: number }[] = [];
  private next = 0;

  constructor(count = 48) {
    const geometry = new THREE.RingGeometry(0.75, 1, 24);
    geometry.rotateX(-Math.PI / 2);
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: '#d8e2ff',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.group.add(mesh);
      this.rings.push({ mesh, age: 1, size: 1 });
    }
  }

  spawn(position: readonly [number, number, number], size: number): void {
    const ring = this.rings[this.next++ % this.rings.length];
    if (!ring) return;
    ring.age = 0;
    ring.size = size;
    ring.mesh.position.set(position[0], position[1] + 0.005, position[2]);
    ring.mesh.visible = true;
  }

  update(dt: number): void {
    for (const ring of this.rings) {
      if (!ring.mesh.visible) continue;
      ring.age += dt / 0.6;
      if (ring.age >= 1) {
        ring.mesh.visible = false;
        continue;
      }
      ring.mesh.scale.setScalar(ring.size * (0.4 + ring.age));
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - ring.age);
    }
  }
}
