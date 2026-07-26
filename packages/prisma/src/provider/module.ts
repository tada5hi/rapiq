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
    postgres: Provider.POSTGRESQL,
    pg: Provider.POSTGRESQL,
    cockroach: Provider.COCKROACHDB,
    mssql: Provider.SQLSERVER,
    sqlserver: Provider.SQLSERVER,
    mongo: Provider.MONGODB,
};

/**
 * Resolve a provider name (the `provider` of a prisma datasource
 * block, or a `PrismaClient`'s active provider) to its capability
 * preset. Common aliases resolve to their canonical provider.
 */
export function resolveProvider(name: string) : ProviderOptions | undefined {
    const normalized = name.toLowerCase();

    return PROVIDERS[ALIASES[normalized] ?? normalized as `${Provider}`];
}

/**
 * The documented last-resort default: postgres: the most common
 * prisma provider and the one whose case contract needs
 * `mode: 'insensitive'` to hold. Mirrors the `@rapiq/typeorm`
 * dialect fallback.
 */
export function resolveProviderOptions(
    input?: `${Provider}` | string | ProviderOptions,
) : ProviderOptions {
    if (typeof input === 'undefined') {
        return PROVIDERS[Provider.POSTGRESQL];
    }

    if (typeof input === 'string') {
        const options = resolveProvider(input);
        if (options) {
            return options;
        }

        // an unknown name must never fall back to a preset: silently
        // treating a typo as postgres would emit `mode: 'insensitive'`
        // that the real connector rejects on every filter.
        throw new AdapterError({
            message: `The prisma provider "${input}" is unknown.`,
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    }

    return input;
}

/**
 * Read the active provider off a prisma client instance: the public
 * `$provider` reflection surface where a client ships it
 * (prisma/prisma#29792), otherwise `_activeProvider`, a private but
 * long-stable client internal verified against real generated clients
 * by the engine suite. Fails typed instead of guessing: a wrong
 * provider breaks every case-insensitive filter.
 */
export function resolveClientProvider(client: object) : `${Provider}` {
    const source = client as Record<string, any>;

    const name = source.$provider ??
        source._activeProvider ??
        source._engineConfig?.activeProvider;

    if (typeof name === 'string') {
        return name as `${Provider}`;
    }

    throw new AdapterError({
        message: 'The provider could not be resolved from the client; pass it explicitly.',
        code: ErrorCode.FEATURE_UNSUPPORTED,
    });
}
