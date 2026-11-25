/**
 * Utilities for resolving Julia's adaptive brand logos across Light Mode, Dark Mode,
 * brand-gradient sidebars, collapsed icon rails, and thermal/PDF monochrome prints.
 */

export const BRAND_LOGO_VERSION = "20261125";

export const DEFAULT_BRAND_LOGO_SETTING = "/logo-wordmark-white.png";

export const BUILTIN_DEFAULT_LOGOS = new Set<string>([
  "/logo-wordmark-white.png",
  "/logo-name-white.png",
  "/logo-wordmark-blue.png",
  "/logo-name-blue.png",
  "/logo-wordmark-mono.png",
  "/logo-icon-color.png",
  "/logo-icon-blue.png",
  "/logo-icon-badge.png",
  "/logo-icon-transparent.png",
  "/logo-wordmark-transparent.png",
  "/logo-client.png",
  "/logo-client.jpg",
  "/logo-wordmark-white.jpg",
]);

export type BrandLogoContext =
  | "name-on-dark"
  | "name-on-light"
  | "wordmark-on-dark"
  | "wordmark-on-light"
  | "icon-on-dark"
  | "icon-on-light"
  | "icon-badge"
  | "mono-print";

const CONTEXT_LOGO_MAP: Record<BrandLogoContext, string> = {
  "name-on-dark": "/logo-name-white.png",
  "name-on-light": "/logo-name-blue.png",
  "wordmark-on-dark": "/logo-wordmark-white.png",
  "wordmark-on-light": "/logo-wordmark-blue.png",
  "icon-on-dark": "/logo-icon-color.png",
  "icon-on-light": "/logo-icon-blue.png",
  "icon-badge": "/logo-icon-badge.png",
  "mono-print": "/logo-wordmark-mono.png",
};

/**
 * Appends the canonical static asset version query string to a built-in logo path
 * so browsers and service workers immediately fetch refreshed transparent assets.
 */
export function withBrandLogoVersion(path: string): string {
  const basePath = path.split("?")[0];
  return `${basePath}?v=${BRAND_LOGO_VERSION}`;
}

/**
 * Returns true only when settings.logoDataUrl contains a client-uploaded custom image
 * (e.g. a data URL or non-built-in asset path), rather than a built-in Julia's brand asset.
 */
export function isCustomBrandLogo(logoDataUrl?: string | null): boolean {
  const trimmed = (logoDataUrl || "").trim();
  if (!trimmed) return false;
  const basePath = trimmed.split("?")[0];
  return !BUILTIN_DEFAULT_LOGOS.has(basePath);
}

/**
 * Resolves the appropriate logo URL for a specific rendering surface.
 * Honors custom uploaded logos if present; otherwise picks the tailored Julia's variant.
 */
export function resolveBrandLogo(
  logoDataUrl: string | null | undefined,
  context: BrandLogoContext
): string {
  if (isCustomBrandLogo(logoDataUrl)) {
    return (logoDataUrl as string).trim();
  }
  return withBrandLogoVersion(CONTEXT_LOGO_MAP[context]);
}

/**
 * Resolves a Light/Dark theme-adaptive logo for headers, login bars, and terminal icons.
 */
export function resolveThemeLogo(
  logoDataUrl: string | null | undefined,
  isDark: boolean,
  style: "name" | "wordmark" | "icon" = "name"
): string {
  const context: BrandLogoContext = isDark
    ? `${style}-on-dark`
    : `${style}-on-light`;
  return resolveBrandLogo(logoDataUrl, context);
}
