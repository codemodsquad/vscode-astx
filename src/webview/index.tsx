import * as React from 'react'
import ReactDOM from 'react-dom/client'
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react'

const el = document.createElement('div')
document.body.appendChild(el)

const root = ReactDOM.createRoot(el)
root.render(<VSCodeButton>Test</VSCodeButton>)
