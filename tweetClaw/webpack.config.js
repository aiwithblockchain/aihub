const path = require('path');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { version } = require('./package.json');

module.exports = (env, argv) => {
    const mode = argv.mode || 'development';

    return {
        mode,
        devtool: mode === 'development' ? 'inline-source-map' : false,
        entry: {
            background: path.resolve(__dirname, 'src/service_work/background.ts'),
            content: path.resolve(__dirname, 'src/content/main_entrance.ts'),
            injection: path.resolve(__dirname, 'src/capture/injection.ts'),
            debug: path.resolve(__dirname, 'src/debug/debug.ts'),
            popup: path.resolve(__dirname, 'src/popup/popup.ts'),
            'content-xhs': path.resolve(__dirname, 'src/content/xhs-main-entrance.ts'),
            'xhs-sign-inject': path.resolve(__dirname, 'src/platforms/xiaohongshu/sign/xhs-sign-inject.ts'),
        },
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'js/[name].js',
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
            alias: {
                linkedom: path.resolve(__dirname, 'src/shims/linkedom.ts'),
            },
            fallback: {
                canvas: false,
                process: false,
            }
        },
        plugins: [
            new webpack.DefinePlugin({
                __EXTENSION_VERSION__: JSON.stringify(version),
            }),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, 'src/platforms/xiaohongshu/sign/xhs-rap-bundle.js'),
                        to: path.resolve(__dirname, 'dist/js/xhs-rap-bundle.js'),
                    },
                ],
            }),
        ],
    };
};
