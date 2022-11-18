/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from 'react'

export default function useEvent<Fn extends (...args: any[]) => any>(
  handler: Fn
): Fn {
  const handlerRef = React.useRef<any>(null) // In a real implementation, this would run before layout effects

  React.useLayoutEffect(() => {
    handlerRef.current = handler
  })

  return React.useCallback((...args: any[]): any => {
    // In a real implementation, this would throw if called during render
    const fn = handlerRef.current
    return fn(...args)
  }, []) as any
}
