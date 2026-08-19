/// <reference types="vite/client" />

declare module "*.module.scss" {
  /**
   * Class names are indexed with `noUncheckedIndexedAccess` on, which would make
   * every lookup `string | undefined`. A missing class is a build-time typo, not
   * a runtime condition worth handling at each use site.
   */
  const classes: { readonly [key: string]: string };
  export default classes;
}
