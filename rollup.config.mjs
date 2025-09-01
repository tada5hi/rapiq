/*
 * Copyright (c) 2022-2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import resolve from '@rollup/plugin-node-resolve';
import { transform } from '@swc/core';
import { builtinModules } from 'node:module';

const extensions = [
    '.js', '.cjs', '.mjs', '.jsx', '.ts', '.tsx',
];

export function createConfig(
    {
        pkg,
        pluginsPre = [],
        pluginsPost = [],
        external = [],
        defaultExport = false,
        swc = {},
    },
) {
    external = Object.keys(pkg.dependencies || {})
        .concat(Object.keys(pkg.peerDependencies || {}))
        .concat(builtinModules)
        .concat(external);

    return {
        input: './src/index.ts',

        // Specify here external modules which you don't want to include in your bundle (for instance: 'lodash', 'moment' etc.)
        // https://rollupjs.org/guide/en/#external
        external,

        plugins: [
            // Allows node_modules resolution
            resolve({ extensions }),

            // Compile TypeScript/JavaScript files
            {
                name: 'swc',
                transform(code) {
                    return transform(code, {
                        jsc: {
                            target: 'es2020',
                            parser: {
                                syntax: 'typescript',
                            },
                            loose: true,
                        },
                        sourceMaps: true,
                    });
                },
            },
        ],
        output: [
            {
                file: pkg.main,
                format: 'cjs',
                sourcemap: true,
            }, {
                file: pkg.module,
                format: 'esm',
                sourcemap: true,
            },
        ],
    };
}
