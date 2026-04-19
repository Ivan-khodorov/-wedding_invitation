const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const autoprefixer = require("autoprefixer");

module.exports = (_, argv) => {
  const isProduction = argv.mode === "production";

  return {
    entry: ["./src/js/index.js", "./src/scss/style.scss"],
    output: {
      filename: "js/main.js",
      path: path.resolve(__dirname, "dist")
    },
    devtool: isProduction ? "source-map" : "eval-source-map",
    devServer: {
      static: {
        directory: path.join(__dirname, "dist")
      },
      historyApiFallback: true,
      hot: true
    },
    module: {
      rules: [
        {
          test: /\.(sass|scss)$/,
          include: path.resolve(__dirname, "src/scss"),
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: "css-loader",
              options: {
                url: false
              }
            },
            {
              loader: "postcss-loader",
              options: {
                sourceMap: true,
                postcssOptions: {
                  plugins: [
                    require("cssnano")({
                      preset: [
                        "default",
                        {
                          discardComments: {
                            removeAll: true
                          }
                        }
                      ]
                    }),
                    autoprefixer({
                      overrideBrowserslist: ["last 2 versions"]
                    })
                  ]
                }
              }
            },
            {
              loader: "sass-loader",
              options: {
                sourceMap: true
              }
            }
          ]
        },
        {
          test: /\.html$/,
          include: path.resolve(__dirname, "src/html/includes"),
          use: ["raw-loader"]
        }
      ]
    },
    optimization: {
      minimize: isProduction
    },
    plugins: [
      ...(isProduction ? [new CleanWebpackPlugin()] : []),
      new MiniCssExtractPlugin({
        filename: "css/main.css"
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "./src/fonts",
            to: "./fonts",
            noErrorOnMissing: true
          },
          {
            from: "./src/favicon",
            to: "./favicon",
            noErrorOnMissing: true
          },
          {
            from: "./src/img",
            to: "./img",
            noErrorOnMissing: true
          }
        ]
      }),
      new HtmlWebpackPlugin({
        filename: "index.html",
        template: path.resolve(__dirname, "index.html"),
        inject: false
      })
    ]
  };
};
