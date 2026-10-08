import { readFileSync } from 'node:fs';
import { basicPack } from '@spawnforge/modules';
import {
  type BufferAttribute,
  Matrix4,
  PerspectiveCamera,
  type SkinnedMesh,
  Vector3,
  Vector4,
} from 'three';
import { describe, expect, it } from 'vitest';
import type { ClipRows, CrowdMember } from './crowd.ts';
import { createBestiary } from './runtime.ts';

const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));

/** The crowd's vertex shader, on the CPU: skinned from the rows, turned and moved. */
function crowdVertex(rows: ClipRows, m: CrowdMember, mesh: SkinnedMesh, v: number): Vector3 {
  const data = rows.texture.image.data as Float32Array;
  const g = mesh.geometry;
  const index = new Vector4().fromBufferAttribute(
    g.getAttribute('skinIndex') as BufferAttribute,
    v,
  );
  const weight = new Vector4().fromBufferAttribute(
    g.getAttribute('skinWeight') as BufferAttribute,
    v,
  );
  const p = new Vector3().fromBufferAttribute(g.getAttribute('position'), v);
  const matrix = (bone: number, row: number) =>
    new Matrix4().fromArray(data, (row * rows.width + bone * 4) * 4);
  const out = new Vector3();
  for (let k = 0; k < 4; k++) {
    const bone = index.getComponent(k);
    const w = weight.getComponent(k);
    const a = p.clone().applyMatrix4(matrix(bone, m.row0));
    const b = p.clone().applyMatrix4(matrix(bone, m.row1));
    out.addScaledVector(a.lerp(b, m.blend), w);
  }
  const root = (row: number) =>
    new Vector3().fromArray(data, (row * rows.width + rows.bones * 4) * 4);
  const c = root(m.row0).lerp(root(m.row1), m.blend);
  return out
    .sub(c)
    .applyQuaternion(m.rotation)
    .add(c)
    .add(new Vector3(m.x, m.y, m.z));
}

describe('crowds (docs/design/11.3-crowds.md)', () => {
  it('poses a member as the baked level of detail poses the creature', async () => {
    const bestiary = await createBestiary({ packs: [basicPack], lodDistance: 2, crowds: true });
    const wolf = await bestiary.spawn(example('grey-wolf'), {
      quality: 'low',
      position: { x: 3, z: -2 },
      heading: 0.7,
    });
    const camera = new PerspectiveCamera(50);
    camera.position.set(0, 2, 60);
    wolf.moveTo({ x: 20, z: 15 });
    // A species joins the crowd once its levels of detail are made (off the first frames).
    for (let i = 0; i < 90 || (!wolf.crowded && i < 300); i++) {
      bestiary.update(1 / 60, { camera });
      if (i % 10 === 0) await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(wolf.lod).toBe('baked');
    expect(wolf.crowded).toBe(true);
    expect(wolf.object.visible).toBe(false);
    // One draw for the species: the wolf's level draws its skin and parts once, the eyes once.
    expect(bestiary.crowd.children).toHaveLength(1);
    const counts = Object.fromEntries(
      (bestiary.crowd.children[0]?.children ?? []).map((m) => [
        m.name,
        (m as unknown as { count: number }).count,
      ]),
    );
    const level = wolf.detail > 0 ? `_LOD${wolf.detail}` : '';
    expect(counts[`crowd_skin${level}`]).toBe(1);
    expect(counts[`crowd_parts${level}`]).toBe(1);
    expect(counts.crowd_eyes).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(3);
    // The rows and the member, against three's own skinning of the creature posed on the CPU.
    const { clipRows } = await import('./crowd.ts');
    const rows = clipRows(wolf.compiled, wolf.bakedClips());
    const skin = wolf.object.getObjectByName('skin') as SkinnedMesh;
    const position = skin.geometry.getAttribute('position');
    /** The farthest a sampled vertex of the crowd's pose lies from three's skinning of the bones. */
    const gap = () => {
      const member = wolf.crowdMember(rows);
      if (!member) throw new Error('no member');
      wolf.hitCapsules();
      skin.skeleton.update();
      let worst = 0;
      for (let v = 0; v < position.count; v += 97) {
        const cpu = skin.applyBoneTransform(v, new Vector3().fromBufferAttribute(position, v));
        worst = Math.max(worst, cpu.distanceTo(crowdVertex(rows, member, skin, v)));
      }
      return { worst, blend: member.blend };
    };
    // Between frames, lerped matrices against slerped bones: a few millimetres on a 1 m wolf.
    expect(gap().worst).toBeLessThan(0.01);
    // On a frame, the same pose.
    const baked = wolf as unknown as {
      baked: { time: number; clip: { duration: number; frames: number } };
      stale: boolean;
    };
    const clip = baked.baked.clip;
    baked.baked.time =
      (Math.round((baked.baked.time / clip.duration) * (clip.frames - 1)) / (clip.frames - 1)) *
      clip.duration;
    baked.stale = true;
    const onFrame = gap();
    expect(onFrame.blend).toBeCloseTo(0, 6);
    expect(onFrame.worst).toBeLessThan(1e-5);
    bestiary.dispose();
  }, 60_000);
});
