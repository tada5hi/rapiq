/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../../errors';
import type { ParseError } from '../../errors';
import type { MaybeAsync } from '../../types';

/**
 * The slice of a parameter schema the key-validation pass consumes —
 * implemented by RelationsSchema, FieldsSchema and SortSchema.
 */
export type KeyValidatableSchema = {
    hasValidator() : boolean,
    validate(name: string, context: any) : MaybeAsync<boolean | undefined>,
};

/**
 * A client-requested key whose governing schema may carry a validate
 * hook. Parsers record one entry per resolved key during resolution
 * and evaluate them once the parameter is assembled, so the sync and
 * async entry points share a single resolution pass.
 */
export type PendingKeyValidation = {
    /**
     * The hook argument — the canonical key relative to the schema
     * that governs it (the target schema for dotted input).
     */
    key: string,
    /**
     * Final dotted output name; parsers prefix it with the relation
     * segment while their recursion unwinds. Used for pruning.
     */
    path: string,
    schema: KeyValidatableSchema,
};

export type KeyValidationOptions = {
    throwOnFailure: boolean,
    errors: typeof ParseError,
};

/**
 * Evaluate the recorded validate-hook obligations. Returns the output
 * names (paths) of rejected keys for the caller to prune — or throws
 * the parameter's ParseError (`ErrorCode.KEY_VALIDATE_REJECTED`) under
 * `throwOnFailure`. A hook returning a Promise here means the caller
 * sits behind a synchronous `parse()`; that is refused the same way as
 * an async filters validator.
 */
export function applyKeySchemaValidation(
    pending: PendingKeyValidation[],
    context: unknown,
    options: KeyValidationOptions,
) : string[] {
    const rejected : string[] = [];

    for (const entry of pending) {
        if (!entry.schema.hasValidator()) {
            continue;
        }

        const verdict = entry.schema.validate(entry.key, context);
        if (isPromiseLike(verdict)) {
            void Promise.resolve(verdict).catch(() => undefined);
            throw SchemaError.validatorAsyncRequiresAsyncParser();
        }

        if (!verdict) {
            if (options.throwOnFailure) {
                throw options.errors.keyValidateRejected(entry.key);
            }

            rejected.push(entry.path);
        }
    }

    return rejected;
}

/**
 * Async counterpart of {@link applyKeySchemaValidation}. Hooks are
 * awaited sequentially so observable execution order matches the
 * synchronous pass.
 */
export async function applyKeySchemaValidationAsync(
    pending: PendingKeyValidation[],
    context: unknown,
    options: KeyValidationOptions,
) : Promise<string[]> {
    const rejected : string[] = [];

    for (const entry of pending) {
        if (!entry.schema.hasValidator()) {
            continue;
        }

        const verdict = await entry.schema.validate(entry.key, context);
        if (!verdict) {
            if (options.throwOnFailure) {
                throw options.errors.keyValidateRejected(entry.key);
            }

            rejected.push(entry.path);
        }
    }

    return rejected;
}

function isPromiseLike(input: unknown) : input is PromiseLike<unknown> {
    return (
        input !== null &&
        (typeof input === 'object' || typeof input === 'function') &&
        'then' in input &&
        typeof input.then === 'function'
    );
}
