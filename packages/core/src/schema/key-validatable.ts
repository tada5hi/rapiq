/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Parameter } from '../constants';
import { SchemaError } from '../errors';
import type { MaybeAsync } from '../types';
import { BaseSchema } from './base';
import type {
    KeyValidatableSchemaOptions,
    KeyValidationScope,
    KeyValidationVerdict,
    KeyValidationVerdictRecord,
} from './types';

/**
 * Shared base of the three sub-schemas whose keys go through the
 * key-validation pass: fields, relations and sort. Owns the `validate` /
 * `validateMany` hook pair so the mutual-exclusion rule and the
 * no-hook fast path are stated once.
 */
export class BaseKeyValidatableSchema<
    OPTIONS extends KeyValidatableSchemaOptions = KeyValidatableSchemaOptions,
> extends BaseSchema<OPTIONS> {
    /**
     * The parameter this sub-schema governs. Declared once, by the
     * subclass — the validation driver derives the hook scope and the
     * condition rules from it, so call sites never respecify it.
     */
    readonly parameter: `${Parameter}`;

    constructor(options: OPTIONS, parameter: `${Parameter}`) {
        super(options);

        this.parameter = parameter;

        // a schema carrying both hooks has no sensible precedence, so fail at
        // definition time rather than silently shadowing one of them.
        if (
            typeof this.options.validate !== 'undefined' &&
            typeof this.options.validateMany !== 'undefined'
        ) {
            throw SchemaError.keyValidatorConflict(parameter);
        }
    }

    // ---------------------------------------------------------

    hasValidator() {
        return typeof this.options.validate !== 'undefined' ||
            typeof this.options.validateMany !== 'undefined';
    }

    hasManyValidator() {
        return typeof this.options.validateMany !== 'undefined';
    }

    /**
     * Invoke the per-key hook for `name`. The caller supplies only the
     * dotted relation path of the position being validated (`''` at the
     * query root) — the schema completes the hook scope from what it
     * already knows about itself (its parameter, its registered name).
     */
    validate(
        name: string,
        context: any,
        path = '',
    ) : MaybeAsync<KeyValidationVerdict> {
        if (typeof this.options.validate === 'undefined') {
            return true;
        }

        return this.options.validate(name, context, this.scope(path));
    }

    validateMany(
        names: string[],
        context: any,
        path = '',
    ) : MaybeAsync<KeyValidationVerdictRecord> {
        if (typeof this.options.validateMany === 'undefined') {
            return {};
        }

        return this.options.validateMany(names, context, this.scope(path));
    }

    protected scope(path: string) : KeyValidationScope {
        return {
            parameter: this.parameter,
            path,
            schema: this.name,
        };
    }
}
