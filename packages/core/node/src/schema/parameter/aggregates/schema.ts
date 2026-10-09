/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../../../errors';
import { AGGREGATE_FUNCTION_SLOTS } from '../../../parameter';
import type { IAggregate } from '../../../parameter';
import type { MaybeAsync, ObjectLiteral } from '../../../types';
import type { KeyValidationVerdict } from '../../types';
import { assertKnownInputKeys } from '../../../utils';
import { BaseSchema } from '../../base';
import { describeCallFunctions, normalizeCallFunctions } from '../call';
import type { CallFunctionNormalized } from '../call';
import type { AggregatesOptions, AggregatesSchemaDescription } from './types';

const AGGREGATES_INPUT_KEYS = ['name', 'functions', 'validate'];

export class AggregatesSchema<
    T extends ObjectLiteral = ObjectLiteral,
    CONTEXT = any,
> extends BaseSchema<AggregatesOptions<T, CONTEXT>> {
    readonly functions : Record<string, CallFunctionNormalized>;

    readonly functionsIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(options: AggregatesOptions<T, CONTEXT> = {}) {
        super(options);

        assertKnownInputKeys(
            options,
            AGGREGATES_INPUT_KEYS,
            (key, suggestion) => SchemaError.keyUnknown(key, suggestion),
        );

        this.functionsIsUndefined = typeof options.functions === 'undefined';
        this.functions = normalizeCallFunctions(AGGREGATE_FUNCTION_SLOTS, options.functions);
    }

    // ---------------------------------------------------------

    hasValidator() : boolean {
        return typeof this.options.validate !== 'undefined';
    }

    /**
     * Invoke the validate hook for one resolved aggregate; accepts when
     * the schema declares none.
     */
    validate(aggregate: IAggregate, context: CONTEXT) : MaybeAsync<KeyValidationVerdict> {
        if (typeof this.options.validate === 'undefined') {
            return true;
        }

        return this.options.validate(aggregate, context);
    }

    // ---------------------------------------------------------

    /**
     * Serialize the declared constraints; `params` shows the open slots
     * of each function only. Arrays are cloned.
     */
    describe() : AggregatesSchemaDescription {
        return { functions: this.functionsIsUndefined ? null : describeCallFunctions(this.functions) };
    }
}
