/* eslint-disable */

const path = require('path')

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/webview/index.tsx',
  output: {
    filename: 'webview.js',
    path: path.resolve(__dirname, 'out', 'assets'),
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
      },
    ],
  },
}
