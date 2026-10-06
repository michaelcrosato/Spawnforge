/** Shared between the Node launcher and the page. */
export type View = 'front' | 'side' | 'top' | 'three-quarter';

export interface RenderRequest {
  readonly blueprint: unknown;
  readonly quality?: 'low' | 'medium' | 'high';
  /** Pixels per panel side (default 512). */
  readonly size?: number;
  /** Label every part and limb by id. */
  readonly labels?: boolean;
  /** Leave the creature's name out of the header (for blind reviews). */
  readonly anonymous?: boolean;
  /** Panels to draw, in order (default all four). */
  readonly views?: readonly View[];
  /** Debugging switches. */
  readonly debug?: {
    readonly hide?: readonly ('skin' | 'parts' | 'eyes')[];
    readonly shadows?: boolean;
  };
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
}

export interface RenderResponse {
  /** PNG as a data URL. */
  readonly png: string;
  readonly width: number;
  readonly height: number;
  readonly info: RenderInfo;
}
