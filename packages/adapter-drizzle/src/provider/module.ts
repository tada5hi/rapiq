/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode } from '@rapiq/core';
import { PROVIDERS, Provider } from './constants';
import type { ProviderOptions } from './types';

const ALIASES : Record<string, `${Provider}`> = {
    postgres: Provider.PG,
    postgresql: Provider.PG,
    mysql2: Provider.MYSQL,
    'better-sqlite3': Provider.SQLITE,
    'libsql': Provider.SQLITE,
    turso: Provider.SQLITE,
};

/**
 * Resolve a dialect name (or a common driver name) to its capability
 * preset.
 */
export function resolveProvider(name: string) : ProviderOptions | undefined {
    const normalized = name.toLowerCase();

    return PROVIDERS[ALIASES[normalized] ?? normalized as `${Provider}`];
}

/**
 * Resolve the `provider` option. An unknown name must never fall
 * back to a preset: silently treating a typo as postgres would emit
 * `ilike` filters the real dialect rejects.
 */
export function resolveProviderOptions(
    input: `${Provider}` | string | ProviderOptions,
) : ProviderOptions {
    if (typeof input === 'string') {
        const options = resolveProvider(input);
        if (options) {
            return options;
        }

        throw new AdapterError({
            message: `The drizzle dialect "${input}" is unknown.`,
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    }

    return input;
}
