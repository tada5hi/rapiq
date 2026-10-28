/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { markInstanceof } from '@ebec/core';
import type { BaseErrorOptions } from '@rapiq/core';
import { BaseError, ErrorCode, isObject } from '@rapiq/core';
import { CACHE_ERROR_MARKER } from './check';

/**
 * A configuration failure of the cache layer. Never a miss: a miss is
 * `null` from a driver, an outage is reported to `onError`; what throws
 * here is something the deployment has to fix.
 */
export class CacheError extends BaseError {
    constructor(message?: string | BaseErrorOptions) {
        if (isObject(message)) {
            message.message = message.message || 'A cache error has occurred.';
        }

        super(message || 'A cache error has occurred.');

        markInstanceof(this, CACHE_ERROR_MARKER);
    }

    /**
     * The root schema handed to the tag derivation is not in the registry.
     */
    static schemaUnresolvable(name: string) {
        return new this({
            message: `The schema "${name}" could not be resolved.`,
            code: ErrorCode.SCHEMA_UNRESOLVABLE,
        });
    }

    /**
     * A relation segment the registry cannot follow. Skipping it would let
     * a result outlive a change to rows it contains, so it is refused.
     */
    static relationUnresolvable(schema: string, relation: string) {
        return new this({
            message: `The relation "${relation}" of schema "${schema}" maps onto a schema the registry does not hold.`,
            code: ErrorCode.SCHEMA_UNRESOLVABLE,
        });
    }

    /**
     * A `maxTtl` below one millisecond: every entry would lapse at once, and
     * Redis refuses the `PX 0` the scripts would send, failing every bump.
     */
    static maxTtlInvalid(value: number) {
        return new this({
            message: `The maxTtl must be a finite number of at least 1 millisecond, got ${value}.`,
            code: ErrorCode.INPUT_INVALID,
        });
    }

    /**
     * An entry ttl that is not a finite number of at least one millisecond.
     * `Number(undefined)` is NaN and slips past `??`, and a NaN ttl would
     * store an entry that never expires, voiding the `maxTtl` bound.
     */
    static ttlInvalid(value: number) {
        return new this({
            message: `The entry ttl must be a finite number of at least 1 millisecond, got ${value}.`,
            code: ErrorCode.INPUT_INVALID,
        });
    }

    /**
     * A client that prefixes every key on its own. The write and invalidate
     * scripts receive the tag keys prefixed by the client, while the read
     * script builds them from the stored tag list without that prefix, so
     * every read would miss.
     */
    static clientKeyPrefixUnsupported(keyPrefix: string) {
        return new this({
            message: `The Redis client sets the keyPrefix "${keyPrefix}", which the cache scripts cannot honor: pass the namespace as the driver prefix instead.`,
            code: ErrorCode.FEATURE_UNSUPPORTED,
        });
    }

    /**
     * A cluster client with a prefix that carries no hash tag: the keys of
     * one store would land in different slots and every script would be
     * answered with CROSSSLOT.
     */
    static prefixHashTagMissing(prefix: string) {
        return new this({
            message: `The prefix "${prefix}" carries no hash tag, which a cluster needs so every key of the store shares one slot: use e.g. "{${prefix}}".`,
            code: ErrorCode.INPUT_INVALID,
        });
    }

    /**
     * A schema without a name has no tags: the name is the vocabulary.
     */
    static schemaNameUndefined() {
        return new this({
            message: 'The schema name is not defined.',
            code: ErrorCode.SCHEMA_NAME_INVALID,
        });
    }
}
