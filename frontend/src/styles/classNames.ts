/** Join class names, dropping anything absent. */
export function cx(...names: (string | false | undefined)[]): string {
  return names.filter((name): name is string => Boolean(name)).join(" ");
}
