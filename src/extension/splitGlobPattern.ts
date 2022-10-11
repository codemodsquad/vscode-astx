export function* splitGlobPattern(pattern: string): Iterable<string> {
  let start = 0
  let braces = 0
  let parens = 0
  let brackets = 0
  for (let i = 0; i < pattern.length; i++) {
    switch (pattern[i]) {
      case '\\':
        i++
        break
      case '(':
        parens++
        break
      case '[':
        brackets++
        break
      case '{':
        braces++
        break
      case ')':
        parens = Math.max(0, parens - 1)
        break
      case ']':
        brackets = Math.max(0, brackets - 1)
        break
      case '}':
        braces = Math.max(0, braces - 1)
        break
      case ',':
        if (!parens && !brackets && !braces) {
          const sub = pattern.substring(start, i).trim()
          if (sub) yield sub
          start = i + 1
        }
        break
    }
  }
  const sub = pattern.substring(start).trim()
  if (sub) yield sub
}
