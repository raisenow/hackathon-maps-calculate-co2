import {resolve} from 'path'
import {getIfUtils, removeEmpty} from 'webpack-config-utils'
import {Configuration, HashedModuleIdsPlugin, HotModuleReplacementPlugin} from 'webpack'
import ProgressBarPlugin from 'progress-bar-webpack-plugin'
import {CleanWebpackPlugin} from 'clean-webpack-plugin'
// import Dotenv from 'dotenv-webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin'
import MiniCssExtractPlugin from 'mini-css-extract-plugin'
import safeParser from 'postcss-safe-parser'
import {BundleAnalyzerPlugin} from 'webpack-bundle-analyzer'

///////////////////////////////////////////////////////////////////////////////

export default (env, argv) => {
  const {ifProd, ifNotProd} = getIfUtils(env && !!env.prod ? {prod: true} : {prod: false}, ['prod'])

  let config: Configuration = {
    mode: ifProd('production', 'development'),
    context: resolve(__dirname, 'src'),
    resolve: {
      symlinks: false,
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.scss', '.yml', '.yaml'],
      modules: [
        resolve(__dirname, 'src'),
        resolve(__dirname, 'node_modules'),
      ],
    },
    entry: [
      './index.tsx',
    ],
    output: {
      publicPath: '',
      path: resolve(__dirname, 'dist'),
      // filename: ifProd('[name]-[contenthash:16].js', '[name].js'),
      filename: ifProd('widget.js', '[name].js'),
      chunkFilename: ifProd('[name]-[contenthash:16].js', '[name].js'),
      crossOriginLoading: 'anonymous',
    },
    module: {
      rules: [
        {
          test: /\.(js|ts)x?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
        },
        {
          test: /\.scss$/,
          use: removeEmpty([
            ifProd({loader: MiniCssExtractPlugin.loader}),
            ifNotProd({loader: 'style-loader'}),
            {loader: 'css-loader', options: {sourceMap: true, importLoaders: 3}},
            {loader: 'postcss-loader', options: {sourceMap: true}},
            {loader: 'resolve-url-loader', options: {sourceMap: true, keepQuery: true}},
            {loader: 'sass-loader', options: {sourceMap: true}},
          ]),
        },
        {
          test: /\.(png|jpe?g|gif|ico|svg|ttf|eot|woff2?)$/,
          loader: 'url-loader',
          options: {
            name: ifProd('[name]-[hash:16].[ext]', '[name].[ext]'),
            limit: 1000,
          },
        },
        {
          test: /\.ya?ml$/,
          use: [
            {loader: 'json-loader'},
            {loader: 'yaml-loader'},
          ],
        },
        {
          test: /\.html$/,
          // loader: 'html-loader',
          // options: {attrs: ['img:src', 'link:href']},

          use: [
            {loader: 'ejs-loader'},
            {loader: 'extract-loader'},
            {loader: 'html-loader', options: {attrs: ['img:src', 'link:href']}},
          ],
        },
      ],
    },
    // devtool: ifProd('source-map', 'cheap-eval-source-map'), // dev: 'inline-source-map'?
    devtool: ifProd('none', 'cheap-eval-source-map'), // dev: 'inline-source-map'?
    devServer: {
      historyApiFallback: {
        disableDotRule: true,
      },
      // noInfo: true,
      hot: true,
      // inline: false,
      // overlay: true,
      open: false,
    },
    optimization: ifProd({
      minimize: true,
      // runtimeChunk: 'single',
      // splitChunks: {
      //   cacheGroups: {
      //     vendor: {
      //       test: /[\\/]node_modules[\\/]/,
      //       name: 'vendor',
      //       chunks: 'all',
      //     },
      //   },
      // },
      removeEmptyChunks: true,
    }),
    plugins: removeEmpty([
      new ProgressBarPlugin(),
      ifProd(new CleanWebpackPlugin({
        // dry: true,
        verbose: true,
      })),
      new HtmlWebpackPlugin({
        template: './index.html',
        // template: '!!ejs-loader!!extract-loader!!html-loader?attrs[]=img:src&attrs[]=link:href!./src/index.html',
        chunksSortMode: 'dependency',
        inject: true,
        // minify: {
        //   collapseWhitespace: true,
        //   removeComments: true,
        //   quoteCharacter: '"',
        // },
      }),
      new ForkTsCheckerWebpackPlugin({
        tsconfig: resolve(__dirname, 'tsconfig.json'),
      }),
      ifNotProd(new HotModuleReplacementPlugin()),
      ifProd(new OptimizeCSSAssetsPlugin({
        cssProcessorOptions: {
          parser: safeParser,
          safe: true,
        },
      })),
      ifProd(new MiniCssExtractPlugin({
        filename: '[name]-[contenthash:16].css',
        chunkFilename: '[name]-[contenthash:16].css',
      })),
      ifProd(new HashedModuleIdsPlugin()), // prod: ?
      // ifProd(new BundleAnalyzerPlugin()),
    ]),
  }

  return removeEmpty(config)
}
