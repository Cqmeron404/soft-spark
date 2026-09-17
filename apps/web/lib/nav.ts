/** Publish and the Roam tab start a search instead of a static match list. */
export const ROAM_HREF = "/matches?roam=1";

export function tabPath(href: string): string {
  return href.split("?")[0] || href;
}

export function tabIsCurrent(pathname: string, href: string): boolean {
  const path = tabPath(href);
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}
