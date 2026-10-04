import { extname } from 'node:path'

/** Turns `My.Home_Movie.2019.mp4` into a readable title. Pure presentation; never an identity. */
export function deriveTitle(fileName: string): string {
  const ext = extname(fileName)
  const base = ext ? fileName.slice(0, -ext.length) : fileName
  let title = base.replace(/_+/g, ' ')
  if (!title.includes(' ')) title = title.replace(/\./g, ' ')
  title = title.replace(/\s+/g, ' ').trim()
  return title.length > 0 ? title : fileName
}

export function sortTitleOf(title: string): string {
  return title.replace(/^(the|a|an)\s+/i, '').toLocaleLowerCase()
}
