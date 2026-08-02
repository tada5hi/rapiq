/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode } from '@rapiq/core';
import type {
    Datamodel,
    DatamodelColumn,
    DatamodelRelation,
    DatamodelTable,
    IMetadata,
} from './types';

const STRING_TYPE = 'string';

type Resolved =    | { kind: 'column', column: DatamodelColumn } |
    { kind: 'relation', relation: DatamodelRelation };

/**
 * Answers the adapter's metadata questions from a hand-written
 * datamodel by walking dotted paths segment by segment. Unknown
 * segments answer `undefined`, never a guess.
 */
export class Metadata implements IMetadata {
    protected tables : Datamodel;

    protected root : string;

    constructor(datamodel: Datamodel, table: string) {
        this.tables = datamodel;
        this.root = table;

        // a misspelled root would answer "unknown" to every question
        // and silently degrade the adapter to its defaults.
        if (!datamodel[table]) {
            throw new AdapterError({
                message: `The table "${table}" is not part of the datamodel.`,
                code: ErrorCode.SCHEMA_UNRESOLVABLE,
            });
        }
    }

    // -----------------------------------------------------------

    isRelation(path: string) : boolean | undefined {
        const resolved = this.resolve(path);
        if (!resolved) {
            return undefined;
        }

        return resolved.kind === 'relation';
    }

    isToMany(path: string) : boolean | undefined {
        const resolved = this.resolve(path);
        if (!resolved || resolved.kind !== 'relation') {
            return undefined;
        }

        return resolved.relation.many;
    }

    isString(path: string) : boolean | undefined {
        const resolved = this.resolve(path);
        if (!resolved || resolved.kind !== 'column') {
            return undefined;
        }

        if (typeof resolved.column.dataType === 'undefined') {
            return undefined;
        }

        return resolved.column.dataType === STRING_TYPE;
    }

    isNullable(path: string) : boolean | undefined {
        const resolved = this.resolve(path);
        if (!resolved || resolved.kind !== 'column') {
            return undefined;
        }

        return resolved.column.nullable;
    }

    // -----------------------------------------------------------

    /**
     * Resolve a dotted path to its column or relation descriptor:
     * every segment but the last must be a relation, and each hop
     * switches to the related table.
     */
    protected resolve(path: string) : Resolved | undefined {
        const segments = path.split('.');

        let table : DatamodelTable | undefined = this.tables[this.root];

        for (let i = 0; i < segments.length; i++) {
            if (!table) {
                return undefined;
            }

            // own-property lookups: the segment originates from a
            // wire filter key, and an inherited name (`constructor`,
            // `toString`, ...) must answer "unknown", not resolve to
            // an Object.prototype member.
            const segment = segments[i] as string;
            const relation = table.relations && Object.hasOwn(table.relations, segment) ?
                table.relations[segment] :
                undefined;

            if (i === segments.length - 1) {
                if (relation) {
                    return { kind: 'relation', relation };
                }

                const column = table.columns && Object.hasOwn(table.columns, segment) ?
                    table.columns[segment] :
                    undefined;
                if (typeof column === 'undefined') {
                    return undefined;
                }

                return {
                    kind: 'column',
                    column: typeof column === 'string' ? { dataType: column } : column,
                };
            }

            if (!relation) {
                return undefined;
            }

            table = this.tables[relation.target];
        }

        return undefined;
    }
}

/**
 * Bind a datamodel to the table a query targets.
 *
 * ```typescript
 * const metadata = defineMetadata({
 *     users: {
 *         columns: {
 *             id: { dataType: 'number', nullable: false },
 *             name: 'string',
 *         },
 *         relations: {
 *             items: { target: 'items', many: true },
 *             realm: { target: 'realms', many: false },
 *         },
 *     },
 *     items: { ... },
 *     realms: { ... },
 * }, 'users');
 * ```
 */
export function defineMetadata(datamodel: Datamodel, table: string) : Metadata {
    return new Metadata(datamodel, table);
}
