import config from '@tada5hi/eslint-config';

export default [
    // rapiq is not a Vue project — keep the Vue ruleset (and its optional plugin) out.
    ...await config({ vue: false }),
    {
        ignores: [
            '**/dist/**',
            '**/coverage/**',
            '**/*.d.ts',
            '.nx/**',
            'packages/docs/**',
        ],
    },
    {
        rules: {
            'class-methods-use-this': 'off',
            'no-continue': 'off',
            'no-shadow': 'off',
            'no-use-before-define': 'off',
            'no-useless-constructor': 'off',
        },
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        rules: {
            '@typescript-eslint/no-use-before-define': 'off',
            '@typescript-eslint/no-useless-constructor': 'off',
            '@typescript-eslint/no-unused-vars': ['error', {
                args: 'after-used',
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
        },
    },
];
