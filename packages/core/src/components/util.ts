/** Join truthy class strings. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ")
}

/** Chain two optional event handlers; the first may not preventDefault-stop
 *  the second (both run). */
export function chain<A extends unknown[]>(
  a?: (...args: A) => void,
  b?: (...args: A) => void,
): ((...args: A) => void) | undefined {
  if (!a) return b
  if (!b) return a
  return (...args: A) => {
    a(...args)
    b(...args)
  }
}
