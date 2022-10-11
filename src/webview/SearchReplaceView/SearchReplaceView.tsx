import * as React from 'react'
import {
  VSCodeTextArea,
  VSCodeTextField,
  VSCodeButton,
} from '@vscode/webview-ui-toolkit/react'
import { css } from '@emotion/css'
import useEvent from '../useEvent'
import useEventListener from '../useEventListener'
import { WebviewApi } from 'vscode-webview'

const params = { find: '', replace: '', include: '', exclude: '' }

type Progress = { completed: number; total: number }

export default function SearchReplaceView({
  vscode,
}: {
  vscode: WebviewApi<any>
}): React.ReactElement {
  const [running, setRunning] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)
  const [progress, setProgress] = React.useState<Progress>({
    completed: 0,
    total: 0,
  })

  useEventListener(window, 'message', (message: any) => {
    const { type, ...rest } = message.data || {}
    switch (type) {
      case 'progress':
        setProgress((p) => ({ ...p, ...rest }))
        break
      case 'start':
        setRunning(true)
        setError(null)
        break
      case 'stop':
      case 'done':
        setRunning(false)
        break
      case 'error':
        setError(rest)
        break
    }
  })

  const postSearch = useEvent((options?: { force?: boolean }) => {
    setTimeout(() => {
      if (params.find || options?.force) {
        vscode.postMessage({
          ...params,
          type: 'search',
        })
      }
    }, 1)
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFindChange = React.useCallback((e: any) => {
    params.find = e.target.value
    postSearch()
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReplaceChange = React.useCallback((e: any) => {
    params.replace = e.target.value
    postSearch()
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleIncludeChange = React.useCallback((e: any) => {
    params.include = e.target.value
    postSearch()
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleExcludeChange = React.useCallback((e: any) => {
    params.exclude = e.target.value
    postSearch()
  }, [])

  const handleKeyDown = useEvent((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      postSearch({ force: true })
    }
  })
  const [showDetails, setShowDetails] = React.useState(true)
  const toggleShowDetails = React.useCallback(
    () => setShowDetails((value) => !value),
    []
  )

  return (
    <div
      onKeyDown={handleKeyDown}
      className={css`
        display: flex;
        flex-direction: column;
      `}
    >
      <VSCodeTextArea
        className={css`
          margin-top: 8px;
        `}
        placeholder="Search"
        name="search"
        onInput={handleFindChange}
      />
      <VSCodeTextArea
        className={css`
          margin-top: 4px;
        `}
        placeholder="Replace"
        name="replace"
        onInput={handleReplaceChange}
      />
      <div
        className={css`
          display: flex;
          justify-content: flex-end;
        `}
      >
        <VSCodeButton appearance="icon" onClick={toggleShowDetails}>
          <span className="codicon codicon-ellipsis" />
        </VSCodeButton>
        <VSCodeButton appearance="icon">
          <span className="codicon codicon-replace-all" />
        </VSCodeButton>
      </div>
      {showDetails && (
        <div
          className={css`
            display: flex;
            flex-direction: column;
          `}
        >
          <VSCodeTextField
            className={css`
              margin-top: 4px;
            `}
            name="filesToInclude"
            onInput={handleIncludeChange}
          >
            files to include
          </VSCodeTextField>
          <VSCodeTextField
            className={css`
              margin-top: 4px;
            `}
            name="filesToExclude"
            onInput={handleExcludeChange}
          >
            files to exclude
          </VSCodeTextField>
        </div>
      )}
      {running && (
        <div>
          Progress: {progress.completed}/{progress.total} (
          {Math.floor((progress.completed * 100) / (progress.total || 1))}%)
        </div>
      )}
    </div>
  )
}
