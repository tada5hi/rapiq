/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, ObjectLiteral, Schema } from '@rapiq/core';
import {
    AdapterError,
    ErrorCode,
    isFilter,
    isFilters,
} from '@rapiq/core';
import { SchemaModelMismatchError } from '../errors';
import type { DatamodelInput, ModelInput } from '../metadata';
import { normalizeDatamodel, resolveModelName } from '../metadata';

const RELATION_KIND = 'object';

/**
 * Verify that every key referenced by the schema exists on the model:
 * plain keys must be scalar or enum field names, dotted keys must be
 * headed by a relation (the remainder belongs to the related model's
 * own schema), and `relations.allowed` keys must be relation field
 * names. Turns silent schema/model drift (e.g. a renamed field) into
 * a boot-time failure instead of a dead allow-list entry or a runtime
 * validation error.
 *
 * @throws SchemaModelMismatchError carrying every offending key.
 */
export function assertSchemaMatchesModel<
    RECORD extends ObjectLiteral = ObjectLiteral,
>(
    schema: Schema<RECORD>,
    input: DatamodelInput,
    modelInput: ModelInput,
) : void {
    const model = resolveModelName(modelInput);

    const target = normalizeDatamodel(input).models.find((item) => item.name === model);
    if (!target) {
        throw new AdapterError({
            message: `The model "${model}" is not part of the datamodel.`,
            code: ErrorCode.SCHEMA_UNRESOLVABLE,
        });
    }

    const columns = new Set<string>();
    const relations = new Set<string>();
    for (const field of target.fields) {
        if (field.kind === RELATION_KIND) {
            relations.add(field.name);
        } else {
            columns.add(field.name);
        }
    }

    const invalid = new Set<string>();

    const headOf = (key: string) => {
        const index = key.indexOf('.');
        return index === -1 ? key : key.substring(0, index);
    };

    const checkColumnKey = (key: unknown) => {
        if (typeof key !== 'string' || columns.has(key)) {
            return;
        }

        // dotted keys must be headed by a relation; the remainder
        // belongs to the related model's own schema.
        const head = headOf(key);
        if (head !== key && relations.has(head)) {
            return;
        }

        invalid.add(key);
    };
    const checkColumnKeys = (keys: string[] | string[][]) => {
        for (const key of keys.flat()) {
            checkColumnKey(key);
        }
    };
    // a filters default is a condition tree, not a key list: walk it
    // and validate every leaf field like a filters allow-list entry.
    const checkCondition = (condition: ICondition) => {
        if (isFilters(condition)) {
            for (const child of condition.value) {
                checkCondition(child);
            }
            return;
        }

        if (isFilter(condition)) {
            checkColumnKey(condition.field);
        }
    };

    checkColumnKeys(schema.fields.default);
    checkColumnKeys(schema.fields.allowed);

    checkColumnKeys(schema.filters.allowed);
    if (schema.filters.default) {
        checkCondition(schema.filters.default);
    }

    checkColumnKeys(schema.sorts.allowed);
    checkColumnKeys(schema.sorts.defaultKeys);

    // relation keys resolve against relations only: the first
    // (or sole) segment must be a relation field name.
    for (const key of schema.relations.allowed || []) {
        if (!relations.has(headOf(key))) {
            invalid.add(key);
        }
    }

    if (invalid.size > 0) {
        throw new SchemaModelMismatchError({
            schema: schema.name,
            model,
            keys: [...invalid],
        });
    }
}
