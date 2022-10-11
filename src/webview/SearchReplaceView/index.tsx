import * as React from 'react'
import ReactDOM from 'react-dom/client'
import SearchReplaceView from './SearchReplaceView'

const vscode = acquireVsCodeApi()

const el = document.createElement('div')
document.body.appendChild(el)

const root = ReactDOM.createRoot(el)
root.render(<SearchReplaceView vscode={vscode} />)

if (module.hot) {
  module.hot.accept('./SearchReplaceView', () => {
    root.render(<SearchReplaceView vscode={vscode} />)
  })
}
