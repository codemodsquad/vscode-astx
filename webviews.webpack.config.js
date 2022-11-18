/* eslint-disable */

const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const isProduction = process.env.NODE_ENV === 'production'
const port = 8378

module.exports = {
  mode: isProduction ? 'production' : 'development',
  entry: {
    SearchReplaceView: './src/SearchReplaceView/SearchReplaceViewEntry.tsx',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'out'),
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
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
    ],
  },
}
