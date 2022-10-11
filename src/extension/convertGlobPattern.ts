import { splitGlobPattern } from './splitGlobPattern'
import path from 'path'

export function joinPatterns(patterns: readonly string[]): string {
  return patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`
}

export function convertGlobPattern(
  patterns: string,
  workspaceFolders: readonly string[]
): string {
  const specificFolderPatterns: Map<string, string[]> = new Map()
  const byName = new Map(workspaceFolders.map((f) => [path.basename(f), f]))
  const generalPatterns: string[] = []
  const resultPatterns = []

  for (const pattern of splitGlobPattern(patterns)) {
    if (path.isAbsolute(pattern)) {
      resultPatterns.push(pattern)
      continue
    }
    const [basedir] = pattern.split(path.sep)
    const workspaceFolder = byName.get(basedir)
    if (workspaceFolder) {
      let forFolder = specificFolderPatterns.get(workspaceFolder)
      if (!forFolder)
        specificFolderPatterns.set(workspaceFolder, (forFolder = []))
      forFolder?.push(path.relative(basedir, pattern))
    } else {
      generalPatterns.push(
        pattern.startsWith('.') ? pattern : path.join('**', pattern)
      )
    }
  }

  for (const [workspaceFolder, patterns] of specificFolderPatterns.entries()) {
    resultPatterns.push(path.join(workspaceFolder, joinPatterns(patterns)))
  }

  if (generalPatterns.length) {
    resultPatterns.push(
      path.join(joinPatterns(workspaceFolders), joinPatterns(generalPatterns))
    )
  }

  return joinPatterns(resultPatterns)
}
