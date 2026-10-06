import {
  compileCreature,
  createRegistry,
  FORMAT,
  instanceNames,
  migrate,
  validateBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/** Format 0.2: plan 2's vocabulary, validated before it is built (docs/design/7.3-format-0.2.md). */
const registry = createRegistry([basicPack]);
const check = (blueprint: Record<string, unknown>) =>
  validateBlueprint({ format: FORMAT, ...blueprint }, registry, { minimal: false });
const limb = (blueprint: Record<string, unknown>, id: string) =>
  check(blueprint).creature?.limbs.find((l) => l.baseId === id);

describe('format 0.2', () => {
  it('relabels 0.1 blueprints, which keep their meaning', () => {
    const result = migrate({ format: 'spawnforge/0.1', extends: 'quadruped' });
    expect(result.doc.format).toBe(FORMAT);
    expect(result.issues.map((i) => i.code)).toEqual(['migrated']);
  });

  it('gives each limb role its own defaults', () => {
    const wing = limb({ extends: 'quadruped', limbs: [{ id: 'wing', role: 'wing' }] }, 'wing');
    expect(wing).toMatchObject({ length: 1.2, at: 0.2, angle: 40, foot: null });
    expect(wing?.membrane?.type).toBe('membrane.bat');
    const fin = limb({ limbs: [{ id: 'fin', role: 'fin', membrane: null }] }, 'fin');
    expect(fin).toMatchObject({ segments: 2, membrane: null });
    const arm = limb({ limbs: [{ id: 'arm', role: 'tentacle', curl: 90 }] }, 'arm');
    expect(arm).toMatchObject({ segments: 10, curl: 90, foot: null });
    // Legs keep 0.1's defaults exactly.
    expect(limb({ limbs: [{ id: 'leg' }] }, 'leg')).toMatchObject({
      length: 0.5,
      at: 0.5,
      angle: 100,
      segments: 3,
    });
  });

  it('keeps role-specific fields to their roles, with hints', () => {
    const errors = check({ limbs: [{ id: 'leg', curl: 90 }] }).errors;
    expect(errors[0]).toMatchObject({ path: 'limbs[id=leg].curl', code: 'unknown_key' });
    expect(errors[0]?.fix).toMatch(/only tentacles curl/);
    expect(check({ limbs: [{ id: 'w', role: 'wing', segments: 9 }] }).errors[0]?.code).toBe(
      'out_of_range',
    );
    expect(check({ limbs: [{ id: 't', role: 'tentacle', segments: 14 }] }).ok).toBe(true);
    expect(check({ limbs: [{ id: 'x', role: 'wings' }] }).errors[0]?.fix).toBe(
      'did you mean "wing"?',
    );
  });

  it('replaces an inherited limb that changes role, and a slot that changes type', () => {
    // The biped's arm has lift-free defaults, 2 segments and a four-toed hand.
    const wing = limb({ extends: 'biped', limbs: [{ id: 'arm', role: 'wing' }] }, 'arm');
    expect(wing).toMatchObject({ role: 'wing', segments: 3, foot: null });
    // A hoof does not inherit the claw's toes.
    const result = check({ extends: 'quadruped', limbs: [{ id: 'foreleg', foot: 'foot.hoof' }] });
    expect(result.errors).toEqual([]);
    expect(result.creature?.limbs[0]?.foot?.params).not.toHaveProperty('toes');
    // The same type still merges field by field.
    const claw = limb(
      { extends: 'quadruped', limbs: [{ id: 'foreleg', foot: { type: 'foot.claw', toes: 2 } }] },
      'foreleg',
    );
    expect(claw?.foot?.params).toMatchObject({ toes: 2 });
  });

  it('merges media over what the body suggests', () => {
    const media = (blueprint: Record<string, unknown>) => check(blueprint).creature?.motion.media;
    expect(media({ extends: 'quadruped' })).toEqual({ land: true, water: false, air: false });
    expect(media({ extends: 'wyvern' })).toEqual({ land: true, water: false, air: true });
    expect(media({ extends: 'fish' })).toEqual({ land: false, water: true, air: false });
    expect(
      media({ limbs: [{ id: 'arm', role: 'tentacle' }] }), // a kraken swims
    ).toEqual({ land: false, water: true, air: false });
    expect(media({ extends: 'wyvern', motion: { media: { water: true } } })).toEqual({
      land: true,
      water: true,
      air: true,
    });
    const grounded = check({ extends: 'quadruped', motion: { media: { air: true } } });
    expect(grounded.errors[0]).toMatchObject({ path: 'motion.media.air', code: 'missing_feature' });
    expect(check({ motion: { media: { land: false } } }).errors[0]?.code).toBe('no_medium');
  });

  it('replaces default gaits only for the media a gait list covers', () => {
    const wyvern = check({ extends: 'wyvern', motion: { gaits: ['walk'] } });
    expect(wyvern.errors).toEqual([]);
    expect(wyvern.creature?.motion.gaits.map((g) => g.type)).toEqual(['walk']);
    // Presets no longer list gaits, so a quadruped gets every gait that suits it.
    expect(check({ extends: 'quadruped' }).creature?.motion.gaits.map((g) => g.type)).toEqual([
      'walk',
      'trot',
    ]);
  });

  it('lists what is not built apart from warnings, and only what the blueprint writes', () => {
    const plain = check({ extends: 'quadruped' });
    expect(plain.notBuilt).toBeUndefined();
    const hydra = check({
      extends: 'quadruped',
      body: { muscle: 0.8, neck: { count: 3, length: 0.7 } },
      skin: { fur: { length: 0.04 } },
    });
    expect(hydra.ok).toBe(true);
    expect(hydra.warnings).toEqual([]);
    expect(hydra.notBuilt?.map((i) => i.path).sort()).toEqual(['body.neck.count', 'skin.fur']);
    expect(hydra.notBuilt?.[0]?.fix).toMatch(/^keep it/);
  });

  it('leaves out what something else implies, and names a skipped host', () => {
    // Wings imply flying and a pincer is not built yet: the role and the parts are listed alone.
    const implied = check({
      extends: 'quadruped',
      limbs: [
        { id: 'foreleg', foot: 'hand.pincer' },
        { id: 'wing', role: 'wing' },
      ],
    });
    expect(implied.notBuilt?.map((i) => i.path).sort()).toEqual([
      'limbs[id=foreleg].foot.type',
      'limbs[id=wing].membrane.type',
      'limbs[id=wing].role',
    ]);
    // Stances are drawn (8.2); swimming is not yet.
    const written = check({
      extends: 'quadruped',
      limbs: [{ id: 'foreleg', foot: 'foot.hoof', stance: 'unguligrade' }],
      motion: { media: { water: true } },
    });
    expect(written.notBuilt?.map((i) => i.message)).toEqual([
      'swimming is in the format but not built yet (plan milestone 10.3), so it is left out for now',
    ]);
    const stalks = check({
      extends: 'serpent',
      limbs: [{ id: 'stalk', role: 'tentacle', attach: { on: 'head' } }],
      parts: [{ id: 'eyes', type: 'eye.basic', attach: { on: 'stalk', at: 1 } }],
    });
    expect(stalks.errors).toEqual([]);
    // Tentacles on the head are stalks, not a swimmer's arms: it stays on land.
    expect(stalks.creature?.motion.media).toEqual({ land: true, water: false, air: false });
    const eyes = stalks.notBuilt?.find((i) => i.path === 'parts[id=eyes].attach.on');
    expect(eyes?.message).toMatch(
      /^"eye.basic" sits on "stalk.L", which is not built yet \(plan milestone 9.4\)/,
    );
  });

  it('names the modules that provide what an action needs', () => {
    const result = check({ extends: 'quadruped', motion: { actions: ['display'] } });
    const missing = result.errors.find((e) => e.code === 'missing_feature');
    expect(missing?.fix).toBe(
      'add a module that provides "display": "frill", "hood", "quills", "sail"; or remove the action',
    );
  });

  it('names extra heads outward from the main one, which keeps the plain name', () => {
    expect(instanceNames('head', 1)).toEqual(['head']);
    expect(instanceNames('head', 3)).toEqual(['head.L1', 'head', 'head.R1']);
    expect(instanceNames('head', 4)).toEqual(['head.L1', 'head', 'head.R1', 'head.R2']);
    const one = check({
      extends: 'quadruped',
      body: { neck: { count: 3, length: 0.7 } },
      parts: [{ id: 'crest', type: 'horn.curved', attach: { on: 'head.R1' } }],
    });
    expect(one.errors).toEqual([]);
    expect(
      check({
        extends: 'quadruped',
        parts: [{ id: 'crest', type: 'horn.curved', attach: { on: 'head.R1' } }],
      }).errors[0]?.code,
    ).toBe('unknown_reference');
  });

  it('warns when several heads would overlap, with a spread that clears it', () => {
    const crowded = check({ extends: 'quadruped', body: { neck: { count: 5, length: 0.05 } } });
    const warning = crowded.warnings.find((w) => w.code === 'heads_overlap');
    expect(warning?.path).toBe('body.neck');
    expect(
      check({ extends: 'quadruped', body: { neck: { count: 5, length: 0.8 } } }).warnings,
    ).toEqual([]);
  });

  it('takes hints for the guesses models make', () => {
    const fix = (blueprint: Record<string, unknown>) => check(blueprint).errors[0]?.fix;
    expect(fix({ body: { heads: 3 } })).toMatch(/body\.neck|"neck": \{ "count"/);
    expect(fix({ limbs: [{ id: 'arm', role: 'arm', hand: 'x' }] })).toMatch(/"foot"/);
    expect(fix({ motion: { fly: true } })).toMatch(/media/);
    expect(fix({ skin: { material: 'fur' } })).toMatch(/"fur": \{\}/);
    expect(fix({ limbs: [{ id: 'w', role: 'wing', membrane: 'wing.feathered' }] })).toBe(
      'did you mean "membrane.feather"?',
    );
    expect(
      fix({ parts: [{ id: 'q', type: 'quills', attach: { on: 'torso', region: 'back' } }] }),
    ).toMatch(/"area"/);
  });

  it('accepts a bare module id for a foot or a membrane', () => {
    const wing = limb(
      { limbs: [{ id: 'wing', role: 'wing', membrane: 'membrane.feather', foot: 'foot.claw' }] },
      'wing',
    );
    expect(wing?.membrane?.type).toBe('membrane.feather');
    expect(wing?.foot?.type).toBe('foot.claw');
  });

  it('compiles what is built and reports the rest', () => {
    const result = check({
      extends: 'quadruped',
      limbs: [{ id: 'wing', role: 'wing' }],
      parts: [{ id: 'barb', type: 'horn.curved', attach: { on: 'wing', at: 0.5 } }],
      body: { neck: { count: 2, length: 0.6 } },
    });
    expect(result.errors).toEqual([]);
    if (!result.creature) throw new Error('invalid');
    const compiled = compileCreature(result.creature, registry, { quality: 'low' });
    expect(compiled.rig.legs).toHaveLength(4);
    expect(compiled.rig.arms).toHaveLength(0);
    expect(compiled.warnings.map((w) => w.path)).toEqual(
      expect.arrayContaining(['limbs[id=wing].role', 'body.neck.count']),
    );
  });

  // The recipes in docs/blueprint.md, "Recipes for the new bodies", written out.
  const tentacle = (angle: number) => ({
    id: `t${angle}`,
    role: 'tentacle',
    attach: { at: 0.9, angle, side: 'both' },
  });
  const recipes: Record<string, Record<string, unknown>> = {
    dragon: {
      extends: 'quadruped',
      limbs: [{ id: 'wing', role: 'wing', length: 1.5 }],
      parts: [{ id: 'horns', type: 'horn.curved', params: { aim: 'back' } }],
      skin: { material: 'scales' },
    },
    bat: {
      extends: 'wyvern',
      limbs: [{ id: 'wing', membrane: { type: 'membrane.bat', fingers: 5 } }],
      parts: [{ id: 'ears', type: 'ear.pointed', attach: { side: 'both' } }],
      skin: { fur: {} },
    },
    hydra: { extends: 'quadruped', body: { neck: { count: 5, length: 0.9 } } },
    cerberus: { extends: 'quadruped', body: { neck: { count: 3, length: 0.4 } } },
    kraken: {
      body: { torso: { radius: [0.2, 0.3, 0.25] }, tail: { length: 0 } },
      limbs: [60, 100, 130, 160].map(tentacle),
    },
    shark: {
      extends: 'fish',
      parts: [
        { id: 'tailfin', type: 'fin.tail', params: { shape: 'forked' } },
        { id: 'teeth', type: 'teeth.row' },
      ],
    },
    spider: {
      extends: 'octopod',
      parts: [{ id: 'fangs', type: 'mandible', params: { shape: 'fang' } }],
    },
    scorpion: {
      extends: 'octopod',
      body: { tail: { length: 2.4, pitch: 40, curl: 200 } },
      limbs: [{ id: 'claw', role: 'arm', attach: { at: 0.02 }, foot: 'hand.pincer' }],
    },
    centaur: {
      extends: 'centaur',
      limbs: [
        { id: 'foreleg', foot: 'foot.hoof' },
        { id: 'hindleg', foot: 'foot.hoof' },
      ],
      parts: [{ id: 'horns', type: 'horn.curved', attach: { side: 'both' } }],
    },
    turtle: {
      extends: 'quadruped',
      limbs: [
        { id: 'foreleg', role: 'fin', membrane: null },
        { id: 'hindleg', role: 'fin', membrane: null },
      ],
      parts: [{ id: 'shell', type: 'shell' }],
      motion: { media: { water: true } },
    },
    fox: {
      extends: 'quadruped',
      body: { tail: { count: 2 } },
      limbs: [
        { id: 'foreleg', foot: 'foot.paw' },
        { id: 'hindleg', foot: 'foot.paw' },
      ],
      skin: { fur: {} },
    },
    griffin: {
      extends: 'quadruped',
      limbs: [
        { id: 'wing', role: 'wing', membrane: 'membrane.feather' },
        { id: 'foreleg', foot: 'foot.talon' },
        { id: 'hindleg', foot: 'foot.paw' },
      ],
      parts: [{ id: 'beak', type: 'beak' }],
      skin: { fur: { region: ['torso', 'limbs', 'tail'] } },
    },
    moth: {
      extends: 'hexapod',
      limbs: [
        { id: 'wing', role: 'wing', membrane: { type: 'membrane.insect', shape: 'broad' } },
        { id: 'hindwing', role: 'wing', attach: { at: 0.3 }, membrane: 'membrane.insect' },
      ],
      parts: [
        { id: 'antennae', type: 'antenna', attach: { side: 'both' }, params: { shape: 'feather' } },
      ],
      skin: { fur: { region: 'torso' } },
    },
    stegosaur: { extends: 'quadruped', parts: [{ id: 'plates', type: 'plates.row' }] },
    sailback: { extends: 'quadruped', parts: [{ id: 'sail', type: 'sail' }] },
    porcupine: { extends: 'quadruped', parts: [{ id: 'quills', type: 'quills' }] },
    frilled: {
      extends: 'quadruped',
      parts: [{ id: 'frill', type: 'frill' }],
      motion: { actions: ['display', 'bite'] },
    },
    cobra: {
      extends: 'serpent',
      parts: [{ id: 'hood', type: 'hood' }],
      motion: { actions: ['display'] },
    },
  };
  it.each(Object.entries(recipes))('the %s recipe validates', (_, blueprint) => {
    const result = check(blueprint);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
