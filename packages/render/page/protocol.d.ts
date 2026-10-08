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
  /** Open the jaw, shut the eyes, spread the wings (each 0 to 1; wings rest folded). */
  readonly pose?: {
    readonly jaw?: number;
    readonly blink?: number;
    readonly spread?: number;
    /** Frills and hoods open, quills and sails raised, 0 at rest to 1 (9.5). */
    readonly flare?: number;
  };
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
  /**
   * Texture maps (docs/design/11.1-textures.md): the skin's map size (512, 1024 or 2048; the
   * others follow), or "none" for vertex colours only. Default: by quality.
   */
  readonly textures?: number | 'none';
  /** Levels of detail for skin and parts (docs/design/11.2-lod.md); default true. */
  readonly lods?: boolean;
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
  /** Each mesh's levels of detail below full: triangles, error in metres, and node name. */
  readonly lods?: Readonly<
    Record<
      string,
      readonly { readonly triangles: number; readonly error: number; readonly node: string }[]
    >
  >;
  /** The maps written: the skin's size, which meshes have which maps, and the bake's time. */
  readonly textures?: {
    readonly size: number;
    readonly maps: Readonly<Record<string, readonly string[]>>;
    readonly ms: number;
    readonly timings: Readonly<Record<string, number>>;
  };
}
export interface ExportResponse {
  /** The .glb, base64. */
  readonly glb: string;
  readonly info: ExportInfo;
}
/** A deliberate mistake in the bake, which the round trip must catch (its mutation test). */
export type Mutation =
  | 'green'
  | 'tangent-sign'
  | 'normal-srgb'
  | 'orm-swap'
  | 'glow-clip'
  | 'v-flip'
  | 'shift';

/**
 * The round trip (docs/design/11.1-textures.md, decision 13): the page exports the blueprint,
 * loads the `.glb` back and compares it with the live creature, view by view.
 */
export interface RoundTripRequest {
  readonly blueprint: unknown;
  readonly quality?: 'low' | 'medium' | 'high';
  /** The skin's map size (default by quality). */
  readonly textures?: number;
  /**
   * The most pixels a view is drawn across (default 2048, in tiles of 1024); views take about one
   * pixel a texel.
   */
  readonly size?: number;
  /** Also compare with the tangents taken out (default true). */
  readonly withoutTangents?: boolean;
  /** Return each view's two images as PNG data URLs. */
  readonly images?: boolean;
  readonly mutate?: Mutation;
  /**
   * Also score one effect's own contribution (with it minus without it) on each side, under a
   * grazing key light: its correlation and its size, loaded over live.
   */
  readonly probe?: 'relief' | 'roughness' | 'glow';
  /** Also return the exported file (base64), e.g. for the glTF validator. */
  readonly glb?: boolean;
}

export interface RoundTripView {
  readonly view: string;
  /** Silhouettes' intersection over union. */
  readonly overlap: number;
  /** Mean absolute difference within the shared silhouette, 0 to 1. */
  readonly mean: number;
  /** Share of those pixels off by more than 20% in some channel. */
  readonly off: number;
  /** The view's width and height in pixels. */
  readonly px?: number;
  /** Pixels per texel of the skin's map across the view (the head's map is twice as dense). */
  readonly perTexel?: number;
  /** Live, then loaded, as PNG data URLs. */
  readonly images?: readonly [string, string];
}

export interface RoundTripResponse {
  readonly bytes: number;
  /** The exported `.glb` in base64, if asked for. */
  readonly glb?: string;
  readonly exportMs: number;
  readonly textures?: ExportInfo['textures'];
  readonly views: readonly RoundTripView[];
  readonly withoutTangents?: readonly RoundTripView[];
  readonly probe?: {
    readonly effect: 'relief' | 'roughness' | 'glow';
    readonly views: readonly {
      readonly view: string;
      readonly correlation: number;
      readonly ratio: number;
    }[];
  };
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
