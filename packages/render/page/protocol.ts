/** Shared between the Node launcher and the page. */
export type View = 'front' | 'side' | 'top' | 'three-quarter' | 'head' | 'rear';

export interface RenderRequest {
  readonly blueprint: unknown;
  readonly quality?: 'low' | 'medium' | 'high';
  /** Pixels per panel side (default 512). */
  readonly size?: number;
  /** Label every part and limb by id. */
  readonly labels?: boolean;
  /** Leave the creature's name out of the header (for blind reviews). */
  readonly anonymous?: boolean;
  /** Panels to draw, in order (default all six). */
  readonly views?: readonly View[];
  /**
   * Render one gait cycle as a filmstrip instead of the contact sheet: frames of the creature
   * walking, with a footfall diagram below.
   */
  readonly filmstrip?: FilmstripRequest;
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
  /** Camera (default side). */
  readonly view?: 'side' | 'three-quarter' | 'top';
}

/** What a filmstrip measured over the cycle (or action) it drew. */
export interface MotionInfo {
  /** The action shown, for action filmstrips. */
  readonly action?: string;
  /** Events the action fired, with seconds from its start. */
  readonly events?: readonly { readonly type: string; readonly time: number }[];
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
