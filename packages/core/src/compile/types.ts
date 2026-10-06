import type { Vector3 } from 'three';

/** What a bone belongs to. */
export type BoneSection =
  | 'root'
  | 'torso'
  | 'neck'
  | 'head'
  | 'jaw'
  | 'tail'
  | 'limb'
  | 'toe'
  | 'eye'
  | 'helper';

/** One bone in rest pose, in model space (metres; Y up, the creature faces +Z). */
export interface BoneDef {
  readonly name: string;
  readonly parent: number;
  readonly section: BoneSection;
  /** The limb, part or section this bone belongs to, e.g. `foreleg.L`, `head`. */
  readonly owner: string;
  readonly head: Vector3;
  readonly tail: Vector3;
  /** Unit vector perpendicular to the bone: dorsal on the main axis, the front face on limbs. */
  readonly up: Vector3;
  /** Radius at the head and tail of the bone (metres). */
  readonly r0: number;
  readonly r1: number;
  /** Cross-section scale across (side) and up the bone. */
  readonly cross: readonly [number, number];
  /** The section's own `at` coordinate at the bone's head and tail. */
  readonly t0: number;
  readonly t1: number;
  /** Part of the skin surface (not root, eye or helper bones). */
  readonly skin: boolean;
  /**
   * Radii at evenly spaced points from head to tail, when the section's profile changes within
   * the bone; the skin follows it with one cone per span instead of a straight taper.
   */
  readonly profile?: readonly number[];
  /** Index of the chain this bone belongs to (-1 for none). */
  readonly chain: number;
}

/** A run of bones that join with a plain union; chains join their parents with a smooth min. */
export interface ChainDef {
  readonly id: string;
  readonly section: BoneSection;
  readonly owner: string;
  readonly bones: readonly number[];
  /** Bone this chain grows from (-1 for the root chain). */
  readonly parentBone: number;
  /** Smooth-min radius where it meets its parent chain (metres). */
  readonly blend: number;
  /** Extra masses (shoulders, hips) unioned into the chain's first bone. */
  readonly masses: readonly { readonly center: Vector3; readonly radius: number }[];
}

/** One leg for the motion controller. */
export interface LegRig {
  readonly id: string;
  readonly pair: number;
  readonly side: 'left' | 'right';
  /** Bones from hip to ankle. */
  readonly bones: readonly number[];
  readonly lengths: readonly number[];
  /** Rest relative joint angles used by the coupled IK (radians). */
  readonly bends: readonly number[];
  /** Rest-pose ankle position and the direction the knee bulges. */
  readonly restFoot: Vector3;
  readonly pole: Vector3;
  /** Total reach (metres). */
  readonly reach: number;
  /** Toe bones, root to tip per toe. */
  readonly toes: readonly (readonly number[])[];
}

export interface ArmRig {
  readonly id: string;
  readonly side: 'left' | 'right' | 'center';
  readonly bones: readonly number[];
  readonly lengths: readonly number[];
  readonly bends: readonly number[];
  readonly pole: Vector3;
  readonly reach: number;
  readonly toes: readonly (readonly number[])[];
}

/** One head with its neck, jaw and eyes. */
export interface HeadRig {
  /** `head` for the main (middle) head at every count; the others `head.L1`, `head.R1`, … */
  readonly id: string;
  /** Neck bones from the torso to the head (empty with no neck). */
  readonly neck: readonly number[];
  readonly head: number;
  /** -1 without a jaw. */
  readonly jaw: number;
  /** Eye bones on this head. */
  readonly eyes: readonly number[];
}

/** One tail. */
export interface TailRig {
  /** `tail` for the main tail; the others `tail.L1`, `tail.R1`, … */
  readonly id: string;
  /** Root to tip; a forked tail's branches share the trunk's bones. */
  readonly bones: readonly number[];
  /** Index in `bones` of the first bone after the shared trunk (0 when the tails are separate). */
  readonly branch: number;
}

/**
 * A chain of bones something drives: springs (tails today; tentacles, antennae and ears from
 * phase 9), the blink (eyelids), the jaw (mandibles close with it) or a flare (frills open,
 * quills rise).
 */
export interface DrivenChain {
  readonly owner: string;
  readonly bones: readonly number[];
  readonly drive: 'spring' | 'blink' | 'jaw' | 'flare';
  /** Springs: how hard each point is pulled back toward its rest place per step (0 to 1). */
  readonly stiffness?: number;
  /** Springs: whether the action goals' `swish` swings it (tails). */
  readonly swish?: boolean;
  /** Other drives: relative joint angles per named pose (`rest`, `open`, …). */
  readonly poses?: Readonly<Record<string, readonly number[]>>;
}

/** A limb chain of one of the new roles (wings, fins, tentacles), from phase 9. */
export interface LimbChainRig {
  readonly id: string;
  readonly side: 'left' | 'right' | 'center';
  readonly bones: readonly number[];
}

/** What the motion controller needs to know about a skeleton. */
export interface Rig {
  readonly root: number;
  /** Torso bones from the back (hips) to the front (chest). */
  readonly spine: readonly number[];
  /** Every head, from the creature's left to its right. */
  readonly heads: readonly HeadRig[];
  /** Index into `heads` of the main head. */
  readonly main: number;
  /** Every tail, from left to right; empty without a tail. */
  readonly tails: readonly TailRig[];
  /** Chains the controller drives (springs, blinks, jaws, flares). */
  readonly chains: readonly DrivenChain[];
  readonly legs: readonly LegRig[];
  readonly arms: readonly ArmRig[];
  readonly wings: readonly LimbChainRig[];
  readonly fins: readonly LimbChainRig[];
  readonly tentacles: readonly LimbChainRig[];
  /** Hip height above the ground in the rest pose (metres). */
  readonly hipHeight: number;
  /** Whether the creature is a sprawler (insect, lizard) or legless. */
  readonly posture: 'upright' | 'sprawl' | 'legless';
}

/** The main head of a rig. */
export const mainHead = (rig: { readonly heads: readonly HeadRig[]; readonly main: number }) =>
  rig.heads[rig.main] as HeadRig;

/** Every eye bone, on every head. */
export const allEyes = (rig: { readonly heads: readonly HeadRig[] }): number[] =>
  rig.heads.flatMap((h) => h.eyes);

export interface Skeleton {
  readonly bones: BoneDef[];
  readonly chains: ChainDef[];
  readonly rig: Rig;
}

/** Context a foot part gets for growing toes off a limb tip. */
export interface ToeContext {
  readonly ankle: Vector3;
  /** Direction of the last limb segment (unit). */
  readonly limbDir: Vector3;
  /** The creature's forward direction, horizontal (unit). */
  readonly forward: Vector3;
  /** Horizontal unit vector toward the limb's own side. */
  readonly outward: Vector3;
  readonly groundY: number;
  readonly role: import('../blueprint/creature.ts').LimbRole;
  /** Limb radius at the tip (metres). */
  readonly tipRadius: number;
  /** Metres per torso length. */
  readonly scale: number;
  readonly mirror: 1 | -1 | 0;
  readonly splay: number;
}

/** One toe: joint positions from the ankle outward, with a radius at each point (metres). */
export interface ToeChain {
  readonly points: readonly Vector3[];
  readonly radii: readonly number[];
}
