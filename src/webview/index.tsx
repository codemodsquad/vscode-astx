import * as React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root'

// eslint-disable-next-line @typescript-eslint/ban-ts-comment

const el = document.createElement('div')
document.body.appendChild(el)

const root = ReactDOM.createRoot(el)
root.render(<Root />)

if (module.hot) {
  module.hot.accept('./Root', () => {
    root.render(<Root />)
  })
}
