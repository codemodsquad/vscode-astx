/* eslint-disable */

const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const isProduction = process.env.NODE_ENV === 'production'
const port = 8378

module.exports = {
  mode: isProduction ? 'production' : 'development',
  entry: './src/webview/index.tsx',
  output: {
    filename: 'webview.js',
    path: path.resolve(__dirname, 'out', 'assets'),
    ...(isProduction ? {} : { publicPath: `http://0.0.0.0:${port}/` }),
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'Hot Module Replacement',
    }),
  ],
  devServer: {
    hot: true,
    port,
    allowedHosts: 'all',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
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
