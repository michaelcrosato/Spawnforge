import {
  anchorAt,
  applyPatch,
  type CompiledCreature,
  formatIssue,
  type PartModule,
  type PatchOp,
  paramsJsonSchema,
  placeOnSkin,
  type Registry,
  resolveBlueprint,
} from '@spawnforge/core';
import type { CreatureObject } from '@spawnforge/three';
import * as THREE from 'three';

/**
 * The place tab (docs/design/12.1-placing.md): pick a part, click the creature to put it there,
 * drag a part to move it, adjust its size and turn, undo and redo, save. Every edit is a
 * `patch` of the blueprint, so what it saves is a blueprint anyone could have written.
 */

type Json = Record<string, unknown>;

/** The creature being edited, as the sandbox shows it. */
export interface PlaceTarget {
  readonly name: string;
  readonly blueprint: Json;
  readonly compiled: CompiledCreature;
  readonly creature: CreatureObject;
}

export interface PlaceHooks {
  readonly canvas: HTMLCanvasElement;
  readonly camera: THREE.Camera;
  readonly scene: THREE.Scene;
  /** The focused creature, standing still in its rest pose while the tab is open. */
  focus(): PlaceTarget | undefined;
  /** Shows an edited blueprint (recompiling the creature); resolves when it is shown. */
  apply(blueprint: Json): Promise<void>;
  /** Writes the blueprint to `creatures/<name>.json`. */
  save(name: string, blueprint: Json): Promise<void>;
  /** Turns the camera's orbiting on or off (off while dragging a part). */
  orbit(enabled: boolean): void;
}

export interface Placer {
  /** Whether the tab is open: clicks on the creature place parts instead of walking it. */
  readonly active: boolean;
  setActive(active: boolean): void;
  /** A new creature was shown: its own undo history. */
  reset(): void;
}

/** A length or an angle, which a handle can drag: the units these params state. */
const HANDLE = /torso length|metre|degree/i;

/** An element with its properties set and children appended. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props))
    (node as unknown as Record<string, string>)[key] = value;
  node.append(...children);
  return node;
}

export function createPlacer(registry: Registry, root: HTMLElement, hooks: PlaceHooks): Placer {
  const surface = registry
    .list('part')
    .filter((m: PartModule) => m.slot === 'surface')
    .map((m) => m.id);
  const typePicker = el('select', { ariaLabel: 'Part to place' });
  typePicker.id = 'place-type';
  typePicker.append(new Option('(pick a part)', ''), ...surface.map((id) => new Option(id, id)));
  const undoButton = el('button', { type: 'button', textContent: 'undo', id: 'place-undo' });
  const redoButton = el('button', { type: 'button', textContent: 'redo', id: 'place-redo' });
  const removeButton = el('button', { type: 'button', textContent: 'remove', id: 'place-remove' });
  const saveName = el('input', { type: 'text', ariaLabel: 'File name', id: 'place-name' });
  const saveButton = el('button', { type: 'button', textContent: 'save', id: 'place-save' });
  const selection = el('div', { className: 'place-selection' });
  const message = el('p', { className: 'place-message', id: 'place-message' });
  root.append(
    el(
      'p',
      {},
      'Pick a part and click the creature to place it. Drag a part to move it; Delete removes it.',
    ),
    el('div', { className: 'place-row' }, typePicker),
    el('div', { className: 'place-row' }, undoButton, redoButton, removeButton),
    el('div', { className: 'place-row' }, 'creatures/', saveName, '.json ', saveButton),
    selection,
    message,
  );

  let active = false;
  let undo: Json[] = [];
  let redo: Json[] = [];
  let selected: string | undefined;
  let busy: Promise<void> = Promise.resolve();
  const say = (text: string) => {
    message.textContent = text;
  };

  /** Applies a blueprint, one edit at a time, so clicks during a recompile wait their turn. */
  const show = (blueprint: Json) => {
    busy = busy.then(() => hooks.apply(blueprint)).then(() => buildSelection());
    return busy;
  };
  /** One edit through `patch`; an invalid one is not applied and its error shows. */
  const edit = (ops: PatchOp[], note: string) => {
    const target = hooks.focus();
    if (!target) return Promise.resolve(false);
    const result = applyPatch(structuredClone(target.blueprint), ops, registry);
    if (!result.ok) {
      say(result.errors.map(formatIssue).join('\n'));
      return Promise.resolve(false);
    }
    undo.push(target.blueprint);
    redo = [];
    say(note);
    return show(result.blueprint).then(() => true);
  };

  /** The blueprint's own part ids, and the expanded spec's (with the preset's). */
  const partIds = (blueprint: Json) => {
    try {
      return new Set(resolveBlueprint(blueprint, registry).parts.map((p) => p.baseId));
    } catch {
      return new Set<string>();
    }
  };
  const freshId = (type: string, blueprint: Json) => {
    const taken = partIds(blueprint);
    const stem = type.split('.').at(-1) ?? 'part';
    for (let n = 1; ; n++) if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`;
  };

  // Picking: the posed mesh under the pointer, and the bind-pose point on it.
  const raycaster = new THREE.Raycaster();
  const pick = (event: PointerEvent, meshes: THREE.Mesh[]) => {
    const rect = hooks.canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      hooks.camera,
    );
    const hit = raycaster.intersectObjects(meshes, false)[0];
    if (!hit?.face) return undefined;
    const mesh = hit.object as THREE.SkinnedMesh;
    // The hit's barycentric coordinates on the posed triangle give the point in the bind pose.
    const corners = [hit.face.a, hit.face.b, hit.face.c];
    const posed = corners.map((i) => mesh.getVertexPosition(i, new THREE.Vector3()));
    const local = mesh.worldToLocal(hit.point.clone());
    const bary = THREE.Triangle.getBarycoord(
      local,
      posed[0] as THREE.Vector3,
      posed[1] as THREE.Vector3,
      posed[2] as THREE.Vector3,
      new THREE.Vector3(),
    );
    const bind = mesh.geometry.getAttribute('position');
    const point = new THREE.Vector3();
    if (bary)
      corners.forEach((i, k) => {
        point.addScaledVector(
          new THREE.Vector3().fromBufferAttribute(bind, i),
          bary.getComponent(k),
        );
      });
    else point.fromBufferAttribute(bind, hit.face.a);
    return { mesh, point, world: hit.point.clone() };
  };

  /** The part nearest a point: its marker's blueprint id, and how far its socket is. */
  const partNear = (compiled: CompiledCreature, point: THREE.Vector3) => {
    let best: { id: string; distance: number } | undefined;
    for (const m of compiled.markers) {
      if (m.kind !== 'part') continue;
      const distance = point.distanceTo(new THREE.Vector3(...m.position));
      if (!best || distance < best.distance) best = { id: m.id.replace(/\.(L|R)$/, ''), distance };
    }
    return best;
  };

  /** Where a part goes for a point on the skin: a mirrored pair off the midline. */
  const attachFor = (compiled: CompiledCreature, point: THREE.Vector3) => {
    const anchor = anchorAt(compiled, point);
    if (!anchor) return undefined;
    const side = anchor.side === 'left' || anchor.side === 'right' ? 'both' : anchor.side;
    // On one limb of a pair (its inner face), the anchor names that limb and its side.
    const own = anchor.on.endsWith('.L') || anchor.on.endsWith('.R');
    return {
      on: anchor.on,
      at: anchor.at,
      angle: anchor.angle,
      side: own ? anchor.side : side,
    };
  };

  // The ghost: where a dragged part will go.
  const ghost = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color: '#ffcc33', depthTest: false, transparent: true }),
  );
  ghost.renderOrder = 10;
  ghost.visible = false;
  hooks.scene.add(ghost);

  let down: { x: number; y: number; part?: string } | undefined;
  let dragTo: THREE.Vector3 | undefined;
  const { canvas } = hooks;
  canvas.addEventListener(
    'pointerdown',
    (event) => {
      const target = hooks.focus();
      if (!active || !target || event.button !== 0) return;
      const { skin, parts } = target.creature.meshes;
      const hit = pick(event, [skin, parts]);
      down = { x: event.clientX, y: event.clientY };
      if (!hit) return;
      // A part is grabbed on the part, or on the skin at its root (within a few centimetres).
      const near = partNear(target.compiled, hit.point);
      const grab =
        near && (hit.mesh === parts || near.distance < target.compiled.scale * 0.06)
          ? near.id
          : undefined;
      if (grab) {
        down.part = grab;
        if (hit.mesh === parts) {
          selected = grab;
          buildSelection();
        }
        hooks.orbit(false);
        ghost.scale.setScalar(target.compiled.scale * 0.03);
      }
    },
    { capture: true },
  );
  canvas.addEventListener('pointermove', (event) => {
    const target = hooks.focus();
    if (!active || !target || !down?.part) return;
    const hit = pick(event, [target.creature.meshes.skin]);
    if (!hit) return;
    dragTo = hit.point;
    ghost.position.copy(hit.world);
    ghost.visible = true;
  });
  const finish = async (event: PointerEvent) => {
    const target = hooks.focus();
    const start = down;
    down = undefined;
    ghost.visible = false;
    hooks.orbit(true);
    if (!active || !target || !start) return;
    const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y) > 5;
    if (start.part && moved) {
      const point = dragTo;
      dragTo = undefined;
      if (!point) return;
      const attach = attachFor(target.compiled, point);
      if (!attach) return;
      await edit(
        [{ op: 'set', path: `parts[id=${start.part}].attach`, value: attach }],
        `moved ${start.part} to ${attach.on} at ${attach.at}, angle ${attach.angle}`,
      );
      return;
    }
    if (moved) return;
    // A click on a part, or by one with no part picked to place, selects it.
    if (start.part && (!typePicker.value || selected === start.part)) {
      selected = start.part;
      buildSelection();
      return;
    }
    if (!typePicker.value) return;
    const hit = pick(event, [target.creature.meshes.skin]);
    if (!hit) return;
    const attach = attachFor(target.compiled, hit.point);
    if (!attach) return;
    const id = freshId(typePicker.value, target.blueprint);
    selected = id;
    await edit(
      [{ op: 'add', path: 'parts', value: { id, type: typePicker.value, attach } }],
      `placed ${id} on ${attach.on} at ${attach.at}, angle ${attach.angle}`,
    );
  };
  canvas.addEventListener('pointerup', (event) => void finish(event));

  const remove = async () => {
    if (!selected) return;
    const id = selected;
    if (await edit([{ op: 'remove', path: `parts[id=${id}]` }], `removed ${id}`))
      selected = undefined;
    buildSelection();
  };
  removeButton.addEventListener('click', () => void remove());
  const step = (from: Json[], to: Json[], note: string) => {
    const target = hooks.focus();
    const blueprint = from.pop();
    if (!target || !blueprint) return;
    to.push(target.blueprint);
    say(note);
    void show(blueprint);
  };
  undoButton.addEventListener('click', () => step(undo, redo, 'undone'));
  redoButton.addEventListener('click', () => step(redo, undo, 'redone'));
  addEventListener('keydown', (event) => {
    if (!active || (event.target as HTMLElement | null)?.closest('input, textarea, select')) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) step(redo, undo, 'redone');
      else step(undo, redo, 'undone');
    } else if (key === 'delete' || key === 'backspace') void remove();
  });
  saveButton.addEventListener('click', async () => {
    const target = hooks.focus();
    const name = saveName.value.trim() || target?.name;
    if (!target || !name) return;
    await busy;
    try {
      await hooks.save(name, (hooks.focus() ?? target).blueprint);
      say(`saved creatures/${name}.json`);
    } catch (error) {
      say(`save failed: ${(error as Error).message}`);
    }
  });

  /** The selected part's handles: its lengths and angles, and its angle around the body. */
  function buildSelection() {
    const target = hooks.focus();
    const spec = target ? safeSpec(target.blueprint) : undefined;
    const part = spec?.parts.find((p) => p.baseId === selected);
    if (!target || !part) {
      selection.replaceChildren();
      return;
    }
    const module = registry.get('part', part.type);
    const schema = module ? (paramsJsonSchema(module.params) as { properties?: Json }) : {};
    const handles: { key: string; label: string; min: number; max: number; value: number }[] = [
      { key: 'attach.angle', label: 'angle (°)', min: 0, max: 180, value: part.angle },
    ];
    for (const [key, node] of Object.entries(schema.properties ?? {})) {
      const p = node as { minimum?: number; maximum?: number; description?: string };
      const value = part.params[key];
      if (typeof value !== 'number' || p.minimum === undefined || p.maximum === undefined) continue;
      if (!HANDLE.test(p.description ?? '')) continue;
      handles.push({ key: `params.${key}`, label: key, min: p.minimum, max: p.maximum, value });
    }
    selection.replaceChildren(
      el('h3', {}, `${part.baseId} (${part.type}) on ${part.on.replace(/\.(L|R)$/, '')}`),
      ...handles.map((h) => {
        const input = el('input', {
          type: 'range',
          min: String(h.min),
          max: String(h.max),
          step: String((h.max - h.min) / 200),
          value: String(h.value),
        });
        input.dataset.handle = h.key;
        const shown = el('span', { textContent: h.value.toFixed(3) });
        input.addEventListener('input', () => {
          shown.textContent = Number(input.value).toFixed(3);
        });
        input.addEventListener('change', () => {
          void edit(
            [{ op: 'set', path: `parts[id=${part.baseId}].${h.key}`, value: Number(input.value) }],
            `${part.baseId} ${h.label} ${Number(input.value).toFixed(3)}`,
          );
        });
        return el('label', { className: 'place-handle' }, h.label, input, shown);
      }),
    );
  }
  const safeSpec = (blueprint: Json) => {
    try {
      return resolveBlueprint(blueprint, registry);
    } catch {
      return undefined;
    }
  };

  // For tests and scripts: where on screen a point of the skin is, and what is placed.
  (globalThis as { spawnforgePlace?: unknown }).spawnforgePlace = {
    /** Client coordinates of the skin at `at` and `angle` on a section instance. */
    screenOf(section: string, at: number, angle: number, mirror = 1) {
      const target = hooks.focus();
      if (!target) return undefined;
      const bind = placeOnSkin(target.compiled, { section, at, angle, mirror }).position;
      // Pose it as its nearest skin vertex is posed.
      const skin = target.creature.meshes.skin;
      const positions = skin.geometry.getAttribute('position');
      let nearest = 0;
      let bestD = Number.POSITIVE_INFINITY;
      const v = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        const d = v.fromBufferAttribute(positions, i).distanceToSquared(bind);
        if (d < bestD) {
          bestD = d;
          nearest = i;
        }
      }
      const world = skin.localToWorld(skin.applyBoneTransform(nearest, bind.clone()));
      const ndc = world.project(hooks.camera);
      const rect = hooks.canvas.getBoundingClientRect();
      return {
        x: rect.left + ((ndc.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - ndc.y) / 2) * rect.height,
      };
    },
    blueprint: () => hooks.focus()?.blueprint,
    idle: () => busy,
  };

  return {
    get active() {
      return active;
    },
    setActive(on: boolean) {
      active = on;
      const target = hooks.focus();
      if (on && target && !saveName.value) saveName.value = target.name;
      if (!on) ghost.visible = false;
    },
    reset() {
      undo = [];
      redo = [];
      selected = undefined;
      const target = hooks.focus();
      if (target) saveName.value = target.name;
      buildSelection();
    },
  };
}
