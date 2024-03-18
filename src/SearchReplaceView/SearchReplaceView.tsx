import * as React from 'react'
import '@vscode/codicons/dist/codicon.css'
import {
  VSCodeTextArea,
  VSCodeTextField,
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeCheckbox,
} from '@vscode/webview-ui-toolkit/react'
import { css, keyframes } from '@emotion/css'
import useEvent from '../react/useEvent'
import {
  SearchReplaceViewStatus,
  SearchReplaceViewValues,
} from './SearchReplaceViewTypes'

const leftAnim = keyframes`
  from, 20% {
    left: 0%;
  }
  to {
    left: 100%;
  }
`
const rightAnim = keyframes`
  from {
    right: 100%;
  }
  80%, to {
    right: 0%;
  }
`

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
  const handleUseFindReplaceClick = React.useCallback(() => {
    onValuesChange({ useTransformFile: false })
  }, [])

  const handleUseTransformFileClick = React.useCallback(() => {
    onValuesChange({ useTransformFile: true })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleFindChange = React.useCallback((e: any) => {
    onValuesChange({ find: e.target.value })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleReplaceChange = React.useCallback((e: any) => {
    onValuesChange({ replace: e.target.value })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleTransformFileChange = React.useCallback((e: any) => {
    onValuesChange({ transformFile: e.target.value })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleRerunAutomaticallyChange = React.useCallback((e: any) => {
    onValuesChange({ paused: !e.target.checked })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleIncludeChange = React.useCallback((e: any) => {
    onValuesChange({ include: e.target.value })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleExcludeChange = React.useCallback((e: any) => {
    onValuesChange({ exclude: e.target.value })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleParserChange = React.useCallback((e: any) => {
    onValuesChange({ parser: e.target.value })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePrettierChange = React.useCallback((e: any) => {
    onValuesChange({ prettier: e.target.checked })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBabelGeneratorHackChange = React.useCallback((e: any) => {
    onValuesChange({ babelGeneratorHack: e.target.checked })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlePreferSimpleReplacementChange = React.useCallback((e: any) => {
    onValuesChange({ preferSimpleReplacement: e.target.checked })
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
      <div
        className={css`
          display: flex;
          align-items: center;
          justify-content: flex-start;
          margin-top: 8px;
        `}
      >
        <VSCodeButton
          className={css`
            flex: 1 1 auto;
          `}
          appearance={values.useTransformFile ? 'secondary' : 'primary'}
          onClick={handleUseFindReplaceClick}
        >
          Find/Replace
        </VSCodeButton>
        <VSCodeButton
          className={css`
            flex: 1 1 auto;
          `}
          appearance={values.useTransformFile ? 'primary' : 'secondary'}
          onClick={handleUseTransformFileClick}
        >
          TransformFile
        </VSCodeButton>
      </div>
      {values.useTransformFile ? (
        <VSCodeTextField
          className={css`
            margin-top: 8px;
          `}
          placeholder="Transform File"
          name="transformFile"
          value={values.transformFile}
          onInput={handleTransformFileChange}
        />
      ) : (
        <>
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
        </>
      )}

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
          <VSCodeCheckbox
            checked={!values.paused}
            onChange={handleRerunAutomaticallyChange}
          >
            Rerun Automatically
          </VSCodeCheckbox>

          <p>Parser</p>
          <VSCodeDropdown
            position="below"
            value={values.parser}
            onChange={handleParserChange}
          >
            <VSCodeOption>babel</VSCodeOption>
            <VSCodeOption>babel/auto</VSCodeOption>
            <VSCodeOption>recast/babel</VSCodeOption>
            <VSCodeOption>recast/babel/auto</VSCodeOption>
          </VSCodeDropdown>
          {values.parser === 'babel' || values.parser === 'babel/auto' ? (
            <VSCodeCheckbox
              checked={values.babelGeneratorHack}
              onChange={handleBabelGeneratorHackChange}
            >
              Preserve Formatting with @babel/generator hack
            </VSCodeCheckbox>
          ) : null}
          <VSCodeCheckbox
            checked={values.prettier}
            onChange={handlePrettierChange}
          >
            Use Prettier if Available
          </VSCodeCheckbox>
          <VSCodeCheckbox
            checked={values.preferSimpleReplacement}
            onChange={handlePreferSimpleReplacementChange}
          >
            Prefer Simple Replacement
          </VSCodeCheckbox>
        </div>
      )}
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
            right: 0;
            top: 0;
            bottom: 0;
            visibility: ${running ? 'visible' : 'hidden'};
            animation: ${running && !completed
              ? [
                  `${leftAnim} 1s ease alternate infinite`,
                  `${rightAnim} 1s ease alternate infinite`,
                ].join(',')
              : 'none'};
            width: ${running && !completed
              ? `initial`
              : `${((completed * 100) / (total || 1)).toFixed(1)}%`};
            background-color: var(--vscode-progressBar-background);
          `}
        />
      </div>
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
