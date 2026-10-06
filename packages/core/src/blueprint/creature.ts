import type {
  CROSS_SECTIONS,
  HEAD_SHAPES,
  LIMB_ROLES,
  REGIONS,
  SKIN_MATERIALS,
  TEMPERAMENTS,
} from './schema.ts';

/**
 * A creature spec: a validated blueprint with presets merged, every default filled, module
 * parameters resolved and mirrored pairs expanded into separate items. This is the input to the
 * compile pipeline. Lengths are still in torso lengths; `scale` converts to metres.
 */
export interface CreatureSpec {
  readonly format: string;
  readonly name: string;
  readonly seed: number;
  readonly extends: string | undefined;
  readonly scale: number;
  readonly body: BodySpec;
  readonly limbs: readonly LimbSpec[];
  readonly parts: readonly PartSpec[];
  readonly skin: SkinSpec;
  readonly motion: MotionSpec;
}

export type CrossSection = (typeof CROSS_SECTIONS)[number];
export type HeadShape = (typeof HEAD_SHAPES)[number];
export type Region = (typeof REGIONS)[number];
export type SkinMaterial = (typeof SKIN_MATERIALS)[number];
export type Temperament = (typeof TEMPERAMENTS)[number];
export type LimbRole = (typeof LIMB_ROLES)[number];

/** Which side of the body an item sits on. Left is +X (the creature faces +Z, Y up). */
export type SideName = 'left' | 'right' | 'center';

export interface BodySpec {
  readonly torso: {
    readonly radius: readonly number[];
    readonly arch: number;
    readonly pitch: number;
    readonly crossSection: CrossSection;
    readonly segments: number;
  };
  readonly neck: {
    readonly length: number;
    readonly radius: readonly number[];
    readonly pitch: number;
    readonly segments: number;
  };
  readonly head: {
    readonly shape: HeadShape;
    readonly length: number;
    readonly radius: number;
    readonly jaw: boolean;
    readonly pitch: number;
    readonly crossSection: CrossSection;
  };
  readonly tail: {
    readonly length: number;
    readonly radius: readonly number[];
    readonly curl: number;
    readonly pitch: number;
    readonly segments: number;
  };
}

export interface FootSpec {
  readonly id: string;
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface LimbSpec {
  /** Instance id, e.g. `foreleg.L`. */
  readonly id: string;
  /** Id as written in the blueprint, e.g. `foreleg`. */
  readonly baseId: string;
  readonly side: SideName;
  /** +1 on the left (+X), -1 on the right, 0 in the centre. */
  readonly mirror: 1 | -1 | 0;
  readonly role: LimbRole;
  readonly on: 'torso' | 'neck' | 'tail';
  readonly at: number;
  readonly angle: number;
  readonly length: number;
  readonly segments: number;
  readonly radius: readonly number[];
  readonly splay: number;
  readonly foot: FootSpec | null;
  /** For legs: pair index counted from the back (0 is the hindmost pair). */
  readonly pair: number | undefined;
}

export interface PartSpec {
  readonly id: string;
  readonly baseId: string;
  readonly type: string;
  readonly side: SideName;
  readonly mirror: 1 | -1 | 0;
  /** Instance id of what it attaches to: a section (`head`, `jaw`, …), limb or part. */
  readonly on: string;
  readonly at: number;
  readonly from: number;
  readonly to: number;
  readonly angle: number;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface LayerSpec {
  readonly id: string;
  readonly type: string;
  readonly region: Region;
  readonly strength: number;
  /** Parameters with colour references (`"accent"`) resolved to `#rrggbb`. */
  readonly params: Readonly<Record<string, unknown>>;
}

export interface ModuleRefSpec {
  readonly type: string;
  readonly params: Readonly<Record<string, unknown>>;
}

export interface SkinSpec {
  readonly palette: Readonly<Record<string, string>>;
  readonly material: SkinMaterial;
  readonly layers: readonly LayerSpec[];
}

export interface MotionSpec {
  readonly temperament: Temperament;
  readonly gaits: readonly ModuleRefSpec[];
  readonly actions: readonly ModuleRefSpec[];
}
