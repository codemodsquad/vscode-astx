import * as React from 'react'
import {
  VSCodeTextArea,
  VSCodeTextField,
  VSCodeButton,
} from '@vscode/webview-ui-toolkit/react'
import { css } from '@emotion/css'
import useEvent from '../useEvent'
import {
  SearchReplaceViewStatus,
  SearchReplaceViewValues,
} from '../../shared/SearchReplaceViewTypes'

export default function SearchReplaceView({
  status: { running, completed, total, error },
  values,
  onValuesChange,
}: {
  status: SearchReplaceViewStatus
  values: SearchReplaceViewValues
  onValuesChange: (values: Partial<SearchReplaceViewValues>) => unknown
}): React.ReactElement {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFindChange = React.useCallback((e: any) => {
    onValuesChange({ find: e.target.value })
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReplaceChange = React.useCallback((e: any) => {
    onValuesChange({ replace: e.target.value })
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleIncludeChange = React.useCallback((e: any) => {
    onValuesChange({ include: e.target.value })
  }, [])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleExcludeChange = React.useCallback((e: any) => {
    onValuesChange({ exclude: e.target.value })
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
      {running && (
        <div>
          Progress: {completed}/{total} (
          {Math.floor((completed * 100) / (total || 1))}%)
        </div>
      )}
    </div>
  )
}
