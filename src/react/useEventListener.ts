import * as React from 'react'

export default function useEventListener(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions
): void {
  React.useEffect((): void | (() => void) => {
    if (target) target.addEventListener(type, listener, options || false)
    return () => {
      if (target) target.removeEventListener(type, listener, options || false)
    }
  }, [target, type, listener, options])
}
