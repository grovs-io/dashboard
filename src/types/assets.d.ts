// Static asset module declarations (*.svg, *.png, …). Next puts this reference in the
// gitignored next-env.d.ts, which does not exist in CI — so tsc failed there on every
// `@/assets/**.svg` import. Referencing Next's own types keeps the two in sync.
/// <reference types="next/image-types/global" />
