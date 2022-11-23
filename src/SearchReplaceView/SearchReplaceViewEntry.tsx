import * as React from 'react'
import ReactDOM from 'react-dom/client'
import SearchReplaceViewController from './SearchReplaceViewController.jsx'

const vscode = acquireVsCodeApi()

const el = document.createElement('div')
document.body.appendChild(el)

const root = ReactDOM.createRoot(el)
root.render(<SearchReplaceViewController vscode={vscode} />)

if (module.hot) {
  module.hot.accept('./SearchReplaceViewController', () => {
    root.render(<SearchReplaceViewController vscode={vscode} />)
  })
}
