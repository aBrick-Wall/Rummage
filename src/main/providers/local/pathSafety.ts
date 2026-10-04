import { isAbsolute, relative, sep } from 'node:path'

/** True when `candidate` is strictly inside `root` (same drive, no `..` escape). */
export function isPathInside(root: string, candidate: string): boolean {
  const rel = relative(root, candidate)
  if (rel === '' || isAbsolute(rel)) return false
  return rel !== '..' && !rel.startsWith(`..${sep}`)
}
