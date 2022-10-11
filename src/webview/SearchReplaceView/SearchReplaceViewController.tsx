import * as React from 'react'
import {
  MessageFromWebview,
  MessageToWebview,
  SearchReplaceViewStatus,
  SearchReplaceViewValues,
} from '../../shared/SearchReplaceViewTypes'
import useEventListener from '../useEventListener'
import SearchReplaceView from './SearchReplaceView'

type SearchReplaceWebviewState = unknown

export interface SearchReplaceWebviewApi {
  /**
   * Post a message to the owner of the webview.
   *
   * @param message Data to post. Must be JSON serializable.
   */
  postMessage(message: MessageFromWebview): void

  /**
   * Get the persistent state stored for this webview.
   *
   * @return The current state or `undefined` if no state has been set.
   */
  getState(): SearchReplaceWebviewState

  /**
   * Set the persistent state stored for this webview.
   *
   * @param newState New persisted state. This must be a JSON serializable object. Can be retrieved
   * using {@link getState}.
   *
   * @return The new state.
   */
  setState<T extends SearchReplaceWebviewState | undefined>(newState: T): T
}

export interface Props {
  vscode: SearchReplaceWebviewApi
}

export default function SearchReplaceViewController({
  vscode,
}: Props): React.ReactElement {
  const [status, setStatus] = React.useState<SearchReplaceViewStatus>({
    running: false,
    completed: 0,
    total: 0,
  })

  const [values, setValues] = React.useState<SearchReplaceViewValues>({
    find: '',
    replace: '',
    include: '',
    exclude: '',
  })

  useEventListener(window, 'message', (message: any) => {
    if (!message.data) return
    const data: MessageToWebview = message.data
    switch (data.type) {
      case 'status':
        setStatus((s) => ({ ...s, ...data.status }))
        break
    }
  })

  const handleValuesChange = React.useCallback(
    (updates: Partial<SearchReplaceViewValues>) => {
      setValues((prev: SearchReplaceViewValues): SearchReplaceViewValues => {
        const values: SearchReplaceViewValues = { ...prev, ...updates }
        vscode.postMessage({ type: 'values', values })
        return values
      })
    },
    []
  )

  return (
    <SearchReplaceView
      status={status}
      values={values}
      onValuesChange={handleValuesChange}
    />
  )
}
