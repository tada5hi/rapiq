/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { createHash } from 'node:crypto';
import {
    REDIS_CACHE_CLOCK_SCRIPT,
    REDIS_CACHE_INVALIDATE_SCRIPT,
    REDIS_CACHE_READ_SCRIPT,
    REDIS_CACHE_WRITE_SCRIPT,
} from './scripts';

/**
 * The name a script is registered under on the client carries a hash of
 * its source: `defineCommand` is last-writer-wins per name, so two versions
 * of this package sharing one client would otherwise run each other's
 * scripts.
 */
function buildCommandName(step: string, source: string) : string {
    return `rapiqCache${step}_${createHash('sha1').update(source).digest('hex').slice(0, 12)}`;
}

export const RedisCacheCommand = {
    CLOCK: buildCommandName('Clock', REDIS_CACHE_CLOCK_SCRIPT),
    WRITE: buildCommandName('Write', REDIS_CACHE_WRITE_SCRIPT),
    READ: buildCommandName('Read', REDIS_CACHE_READ_SCRIPT),
    INVALIDATE: buildCommandName('Invalidate', REDIS_CACHE_INVALIDATE_SCRIPT),
} as const;

export const RedisCacheScript : Record<string, string> = {
    [RedisCacheCommand.CLOCK]: REDIS_CACHE_CLOCK_SCRIPT,
    [RedisCacheCommand.WRITE]: REDIS_CACHE_WRITE_SCRIPT,
    [RedisCacheCommand.READ]: REDIS_CACHE_READ_SCRIPT,
    [RedisCacheCommand.INVALIDATE]: REDIS_CACHE_INVALIDATE_SCRIPT,
};
