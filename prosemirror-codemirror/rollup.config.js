import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';

export default {
    input: 'src/main.js', // Entry point for the bundle
    output: {
        file: 'dist/prosemirror-bundle.min.js', // Output file path and name
        format: 'umd', // Format of the output bundle (Universal Module Definition)
        name: 'ProseMirror' // Name of the exported global variable
    },
    plugins: [
        resolve({
            browser: true, // Resolve modules for browser environment
            preferBuiltins: false // Do not prefer built-in modules over local modules
        }),
        commonjs(), // Convert CommonJS modules to ES6
        replace({
            'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'), // Replace NODE_ENV variable with 'development' (or current environment)
            preventAssignment: true // Prevent replacement of variable assignment
        }),
        (process.env.NODE_ENV === 'production' && terser()) // If in production environment, minify the code
    ]
};
