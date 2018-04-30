var path = require('path');
var webpack = require('webpack');
var autoprefixer = require('autoprefixer');
var CopyWebpackPlugin = require('copy-webpack-plugin');
var CleanWebpackPlugin = require('clean-webpack-plugin');
var mode = process.env.NODE_ENV.match(/prod/) ? 'production' : 'development';

var rules = [
    {
      test: /\.jsx?$/,
      include: path.join(__dirname, 'src'),
      use: {
        loader: 'babel-loader',
        options: {
          presets: [
            ['es2015', { "modules": false } ], 'react'
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

plugins.push(new CleanWebpackPlugin(['app/**/*.*']));
plugins.push(new CopyWebpackPlugin([{ from: 'static', to: '.' }]));
plugins.push(
  new webpack.LoaderOptionsPlugin({
    options: {
      postcss: [ autoprefixer({ browsers: ['last 40 versions'] }) ]
    }
  })
);
plugins.push(
  new webpack.DefinePlugin({
    PRODUCTION: mode === 'production'
  })
);

module.exports = {
  mode: mode,
  entry: {
    app: './src/app.js',
    settings: './src/settings.jsx'
  },
  output: {
    path: path.resolve(__dirname, 'app'),
    filename: '[name].js',
    publicPath: '/'
  },
  // Currently we need to add '.ts' to resolve.extensions array.
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json', '.scss', '.css'],
    modules: ['node_modules', 'src']
  },

  // Source maps support (or 'inline-source-map' also works)
  devtool: (mode === 'production') ? 'none' : 'inline-source-map',

  // Add loader for .ts files.
  module: {
    rules: rules
  },

  plugins: plugins,
  optimization: {
    minimize: (mode === 'production')
  }
};