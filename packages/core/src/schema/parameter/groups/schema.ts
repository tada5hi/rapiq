/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SchemaError } from '../../../errors';
import { GROUP_FUNCTION_SLOTS } from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import { assertKnownInputKeys, isPropertyNameValid } from '../../../utils';
import { BaseSchema } from '../../base';
import { describeCallFunctions, normalizeCallFunctions } from '../call';
import type { CallFunctionNormalized } from '../call';
import type { GroupsOptions, GroupsSchemaDescription } from './types';

const GROUPS_INPUT_KEYS = ['name', 'allowed', 'functions'];

export class GroupsSchema<
    T extends ObjectLiteral = ObjectLiteral,
> extends BaseSchema<GroupsOptions<T>> {
    readonly allowed : string[];

    readonly allowedIsUndefined : boolean;

    readonly functions : Record<string, CallFunctionNormalized>;

    readonly functionsIsUndefined : boolean;

    // ---------------------------------------------------------

    constructor(options: GroupsOptions<T> = {}) {
        super(options);

        assertKnownInputKeys(
            options,
            GROUPS_INPUT_KEYS,
            (key, suggestion) => SchemaError.keyUnknown(key, suggestion),
        );

        this.allowedIsUndefined = typeof options.allowed === 'undefined';
        this.allowed = [...(options.allowed ?? [])];

        for (const column of this.allowed) {
            if (!isPropertyNameValid(column)) {
                throw SchemaError.functionInvalid(column, 'the column is not a valid identifier');
            }
        }

        this.functionsIsUndefined = typeof options.functions === 'undefined';
        this.functions = normalizeCallFunctions(GROUP_FUNCTION_SLOTS, options.functions, this.allowed);
    }

    // ---------------------------------------------------------

    /**
     * Serialize the declared constraints; `params` shows the open slots
     * of each function only. Arrays are cloned.
     */
    describe() : GroupsSchemaDescription {
        return {
            allowed: this.allowedIsUndefined ? null : [...this.allowed],
            functions: this.functionsIsUndefined ? null : describeCallFunctions(this.functions),
        };
    }
}
