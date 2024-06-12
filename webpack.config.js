var path = require('path');
var webpack = require('webpack');
var autoprefixer = require('autoprefixer');
var CopyPlugin = require('copy-webpack-plugin');
var CleanWebpackPlugin = require('clean-webpack-plugin').CleanWebpackPlugin;
var NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

var mode = process.env.NODE_ENV.match(/prod/) ? 'production' : 'development';

var rules = [
  {
    test: /\.jsx?$/,
    include: path.join(__dirname, 'src'),
    use: {
      loader: 'babel-loader',
        options: {
          cacheDirectory: true,
          babelrc: false,
          presets: [
            [
              '@babel/preset-env',
              { targets: { browsers: 'last 2 versions' } }
            ],
            '@babel/preset-react'
          ]
        }
    }
  },
  {
    test: /\.s?css$/,
    use: [{
        loader: "style-loader"
      }, {
        loader: "css-loader",
        options: { url: false }
      }, {
        loader: "postcss-loader"
      }, {
        loader: "sass-loader"
      }
    ]
  }
];
var plugins = [];

plugins.push(new CleanWebpackPlugin({
  plugins: ['app/**/*.*']
}));
plugins.push(new CopyPlugin({
  patterns: [
    { from: 'static', to: '.' },
    (/firefox/.test(process.env.SYNCMARX_MANIFEST)) ?
      {
        from:  'src/manifest-firefox.json',
        to: './manifest.json',
      } :
      {
        from:  'src/manifest.json',
        to: './manifest.json'
      }
    ]
}));
plugins.push(
  autoprefixer
);
plugins.push(
  new webpack.DefinePlugin({
    PRODUCTION: mode === 'production',
    'process.env.NODE_ENV': (mode === 'production') ? JSON.stringify('production') : JSON.stringify('development')
  })
);
plugins.push(
  new NodePolyfillPlugin({
    // Note: Newer versions of the Dropbox SDK and cryptr libraries have a hard dependency on native Node.js libs
    includeAliases: ['crypto','stream', 'Buffer']
  })
);
plugins.push(
    // Fix "process is not defined" error:
    new webpack.ProvidePlugin({
      process: 'process/browser',
    }),
);

module.exports = {
  mode: mode,
  entry: {
    app: './src/core/App.js',
    settings: './src/core/Settings.jsx'
  },
  output: {
    path: path.resolve(__dirname, 'App'),
    filename: '[name].js',
    publicPath: '/'
  },
  // Currently we need to add '.ts' to resolve.extensions array.
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json', '.scss', '.css'],
    modules: ['node_modules', 'src'],
    fallback: { vm: false }
  },

  // Source maps support (or 'inline-source-map' also works)
  devtool: (mode === 'production') ? undefined : 'inline-source-map',

  // Add loader for .ts files.
  module: {
    rules: rules
  },

  plugins: plugins,
  optimization: {
    minimize: false
  }
};