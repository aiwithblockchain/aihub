const path = require('path');

module.exports = (env, argv) => {
    const mode = argv.mode || 'development';

    return {
        mode,
        devtool: mode === 'development' ? 'inline-source-map' : false,
        entry: {
            background: path.resolve(__dirname, 'src/service_work/background.ts'),
            content: path.resolve(__dirname, 'src/content/main_entrance.ts'),
            injection: path.resolve(__dirname, 'src/capture/injection.ts'),
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
        },
    };
};
