/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../../../errors';
import { AGGREGATE_FUNCTION_SLOTS } from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import { assertKnownInputKeys } from '../../../utils';
import { BaseSchema } from '../../base';
import { describeCallFunctions, normalizeCallFunctions } from '../call';
import type { CallFunctionNormalized } from '../call';
import type { AggregatesOptions, AggregatesSchemaDescription } from './types';

const AGGREGATES_INPUT_KEYS = ['name', 'functions'];

export class AggregatesSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<AggregatesOptions<T>> {
    readonly functions : Record<string, CallFunctionNormalized>;

    readonly functionsIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(options: AggregatesOptions<T> = {}) {
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

    /**
     * Serialize the declared constraints; `params` shows the open slots
     * of each function only. Arrays are cloned.
     */
    describe() : AggregatesSchemaDescription {
        return { functions: this.functionsIsUndefined ? null : describeCallFunctions(this.functions) };
    }
}
