import * as React from 'react'
import {
  VSCodeTextArea,
  VSCodeTextField,
  VSCodeButton,
} from '@vscode/webview-ui-toolkit/react'
import { css } from '@emotion/css'
import useEvent from '../react/useEvent'
import {
  SearchReplaceViewStatus,
  SearchReplaceViewValues,
} from './SearchReplaceViewTypes'

export default function SearchReplaceView({
  status: {
    running,
    completed,
    total,
    numMatches,
    numFilesWithMatches,
    numFilesWithErrors,
    numFilesThatWillChange,
  },
  values,
  onValuesChange,
  onReplaceAllClick,
}: {
  status: SearchReplaceViewStatus
  values: SearchReplaceViewValues
  onValuesChange: (values: Partial<SearchReplaceViewValues>) => unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReplaceAllClick: (e: React.SyntheticEvent<any>) => unknown
}): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFindChange = React.useCallback((e: any) => {
    onValuesChange({
      find: e.target.value,
    })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReplaceChange = React.useCallback((e: any) => {
    onValuesChange({
      replace: e.target.value,
    })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleIncludeChange = React.useCallback((e: any) => {
    onValuesChange({
      include: e.target.value,
    })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleExcludeChange = React.useCallback((e: any) => {
    onValuesChange({
      exclude: e.target.value,
    })
  }, [])

  const handleKeyDown = useEvent((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      onValuesChange({})
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
        value={values.find}
        onInput={handleFindChange}
      />
      <VSCodeTextArea
        className={css`
          margin-top: 4px;
        `}
        placeholder="Replace"
        name="replace"
        value={values.replace}
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
        <VSCodeButton
          appearance="icon"
          onClick={onReplaceAllClick}
          disabled={running || !numFilesThatWillChange}
        >
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
            value={values.include}
            onInput={handleIncludeChange}
          >
            files to include
          </VSCodeTextField>
          <VSCodeTextField
            className={css`
              margin-top: 4px;
            `}
            name="filesToExclude"
            value={values.exclude}
            onInput={handleExcludeChange}
          >
            files to exclude
          </VSCodeTextField>
        </div>
      )}
      {running ? (
        <div
          className={css`
            margin-top: 8px;
            height: 4px;
            position: relative;
          `}
        >
          <div
            className={css`
              position: absolute;
              left: 0;
              top: 0;
              bottom: 0;
              width: ${((completed * 100) / (total || 1)).toFixed(1)}%;
              background-color: var(--vscode-progressBar-background);
            `}
          />
        </div>
      ) : null}
      {numMatches ? (
        <div
          className={css`
            margin-top: 8px;
            opacity: 0.65;
          `}
        >
          Found {numMatches} {numMatches === 1 ? 'match' : 'matches'} in{' '}
          {numFilesWithMatches} {numFilesWithMatches === 1 ? 'file' : 'files'}
        </div>
      ) : null}
      {numFilesWithErrors ? (
        <div
          className={css`
            margin-top: 8px;
            color: var(--vscode-list-errorForeground);
          `}
        >
          {numFilesWithErrors} {numFilesWithErrors === 1 ? 'file' : 'files'} had
          errors
        </div>
      ) : null}
    </div>
  )
}
