/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Column facts, in drizzle's own vocabulary: `dataType` matches a
 * drizzle column's `dataType` (`'string'`, `'number'`, `'boolean'`,
 * `'date'`, ...), `nullable` is the inverse of `notNull`. Both may
 * stay undeclared: the adapter treats them as unknown, never as a
 * guess. A bare data-type string is accepted as shorthand.
 */
export type DatamodelColumn = {
    dataType?: string,
    nullable?: boolean,
};

export type DatamodelColumnInput = DatamodelColumn | string;

/**
 * Relation facts: the key of the related table inside the datamodel
 * and the cardinality (`many: true` for a `r.many` relation).
 */
export type DatamodelRelation = {
    target: string,
    many: boolean,
};

export type DatamodelTable = {
    columns?: Record<string, DatamodelColumnInput>,
    relations?: Record<string, DatamodelRelation>,
};

/**
 * A hand-written description of the tables a query can traverse,
 * keyed the way `defineRelations` keys them. Declared locally so this
 * package never imports from `drizzle-orm`.
 */
export type Datamodel = Record<string, DatamodelTable>;

/**
 * What the adapter needs to know about the targeted table. Every
 * question may answer `undefined` for "unknown": the adapter then
 * falls back to its documented default instead of guessing silently.
 */
export interface IMetadata {
    /**
     * Whether the addressed path is a relation rather than a column.
     * A relation accepts a nested filter object or a presence test,
     * so a null check on one must be expressed as presence, not as a
     * null comparison.
     */
    isRelation(path: string): boolean | undefined;

    /**
     * Whether the relation addressed by a dotted path is to-many
     * rather than to-one: decides the shape of the absence arm.
     */
    isToMany(path: string): boolean | undefined;

    /**
     * Whether the field addressed by a dotted path holds strings and
     * may therefore participate in case-insensitive comparison. The
     * capability veto on the fold policy: the direct analogue of the
     * `@rapiq/adapter-typeorm` column-type check.
     */
    isString(path: string): boolean | undefined;

    /**
     * Whether the field addressed by a dotted path can hold null.
     *
     * Load-bearing: the null-inclusive complement of a negated
     * operator adds an `isNull` arm; known non-nullable columns drop
     * it, semantically identical, since no null can exist there.
     */
    isNullable(path: string): boolean | undefined;
}
