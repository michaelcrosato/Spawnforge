/** The Khronos glTF validator (it ships no types): the part the tests use. */
declare module 'gltf-validator' {
  interface Message {
    readonly code: string;
    readonly message: string;
    readonly severity: number;
    readonly pointer?: string;
  }
  interface Report {
    readonly issues: {
      readonly numErrors: number;
      readonly numWarnings: number;
      readonly messages: readonly Message[];
    };
  }
  export function validateBytes(
    data: Uint8Array,
    options?: { readonly maxIssues?: number },
  ): Promise<Report>;
}
