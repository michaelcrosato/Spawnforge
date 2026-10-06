import type { ScenarioResult } from '@spawnforge/core';
/** Shared between the Node launcher and the page. */
export type View = 'front' | 'side' | 'top' | 'three-quarter' | 'head' | 'rear' | 'underside';
export interface RenderRequest {
  readonly blueprint: unknown;
  readonly quality?: 'low' | 'medium' | 'high';
  /** Pixels per panel side (default 512). */
  readonly size?: number;
  /** Label every part and limb by id. */
  readonly labels?: boolean;
  /** For blind reviews: leave out the creature's name and, on filmstrips, gait, action and event names. */
  readonly anonymous?: boolean;
  /** Panels to draw, in order (default the six views; `underside` only when asked). */
  readonly views?: readonly View[];
  /**
   * Render one gait cycle as a filmstrip instead of the contact sheet: frames of the creature
   * walking, with a footfall diagram below.
   */
  readonly filmstrip?: FilmstripRequest;
  /** Contact sheets: the jaw open (0 shut to 1 wide) and the eyelids shut (0 to 1). */
  readonly pose?: { readonly jaw?: number; readonly blink?: number };
  /** Debugging switches. */
  readonly debug?: {
    readonly hide?: readonly ('skin' | 'parts' | 'eyes')[];
    readonly shadows?: boolean;
  };
}
export interface FilmstripRequest {
  /**
   * An action id (one of the creature's actions) to show instead of a gait: the creature stands
   * and performs it once, aimed at a point in front of its head.
   */
  readonly action?: string;
  /** Gait id to show (default: whichever the creature uses at `speed`). */
  readonly gait?: string;
  /** Metres per second (default: typical for the gait, or the temperament's walking pace). */
  readonly speed?: number;
  /** Frames across one cycle, 2 to 16 (default 8). */
  readonly frames?: number;
  /** Camera (default side; top for legless bodies; 3/4 close on the head for actions). */
  readonly view?: 'side' | 'three-quarter' | 'top' | 'front';
  /**
   * A scenario (see `ScenarioSchema` in core) to draw instead of a gait cycle: frames evenly
   * spaced over its duration, its targets marked, its events on a timeline.
   */
  readonly scenario?: unknown;
}
/** What a filmstrip measured over the cycle (or action) it drew. */
export interface MotionInfo {
  /** The action shown, for action filmstrips. */
  readonly action?: string;
  /** Events the action fired, with seconds from its start. */
  readonly events?: readonly {
    readonly type: string;
    readonly time: number;
  }[];
  readonly gait: string;
  /** Metres per second. */
  readonly speed: number;
  /** Seconds per gait cycle. */
  readonly cycle: number;
  /** Metres travelled per cycle. */
  readonly stride: number;
  /** Share of the cycle each foot is planted, by leg id. */
  readonly duty: Readonly<Record<string, number>>;
  /** Largest distance a planted foot slid during the cycle (metres). */
  readonly footSlide: number;
  /** Scenario filmstrips: what the run measured. */
  readonly scenario?: ScenarioResult;
}
export interface RenderInfo {
  readonly name: string;
  /** Metres, from the rest pose bounds. */
  readonly length: number;
  readonly height: number;
  readonly width: number;
  readonly triangles: number;
  readonly compileMs: number;
  readonly renderMs: number;
  readonly backend: string;
  readonly warnings: readonly string[];
  /** Filmstrips only. */
  readonly motion?: MotionInfo;
}
export interface RenderResponse {
  /** PNG as a data URL. */
  readonly png: string;
  readonly width: number;
  readonly height: number;
  readonly info: RenderInfo;
}
/** Asks the page for a .glb of the creature. */
export interface ExportRequest {
  readonly blueprint: unknown;
  readonly quality?: 'low' | 'medium' | 'high';
  /** Clips to bake: "idle", gait ids, action ids (default: all the creature has). */
  readonly clips?: readonly string[];
  /** Frames per second for baked clips (default 30). */
  readonly fps?: number;
  /** JSON stored in the file's extras (`extras.spawnforge`), e.g. the blueprint and stats. */
  readonly extras?: Record<string, unknown>;
}
export interface ExportInfo {
  readonly name: string;
  readonly bytes: number;
  readonly triangles: number;
  readonly bones: number;
  readonly sockets: readonly string[];
  readonly clips: readonly {
    readonly name: string;
    readonly duration: number;
    readonly loop: boolean;
  }[];
  /** Things worth knowing about the file, e.g. an idle that is only a standing pose. */
  readonly notes: readonly string[];
  readonly exportMs: number;
}
export interface ExportResponse {
  /** The .glb, base64. */
  readonly glb: string;
  readonly info: ExportInfo;
}
/**
 * The CPU–GPU parity test: the page compiles the blueprint, draws the pattern stack unlit at the
 * given skin vertices, one pixel each, and returns the raw outputs (see three's `stackMaterial`).
 */
export interface ParityRequest {
  readonly blueprint: unknown;
  readonly quality?: 'low' | 'medium' | 'high';
  /** Skin vertex indices to sample. */
  readonly samples: readonly number[];
}
export interface ParityResponse {
  /** Per pass, four floats per sample: albedo and roughness; relief × 1000 and glow; mouth. */
  readonly passes: readonly (readonly number[])[];
  /** The render target's texel type: "float" or "half". */
  readonly precision: 'float' | 'half';
}
