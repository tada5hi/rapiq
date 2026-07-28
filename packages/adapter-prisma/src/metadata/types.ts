/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Structural subset of a prisma DMMF field. Declared locally so this
 * package never imports from `@prisma/client`: `Prisma.dmmf.datamodel`
 * is assignable to {@link Datamodel} as-is, and a hand-written literal
 * works just as well.
 */
export type DatamodelField = {
    name: string,

    /**
     * `'object'` marks a relation field; scalars and enums address
     * columns.
     */
    kind: string,

    /**
     * Relation fields: to-many. Scalars: a scalar list.
     */
    isList: boolean,

    /**
     * Inverse of nullability: a required field can never hold null.
     */
    isRequired: boolean,

    /**
     * Scalar type name (`'String'`, `'Int'`, …) or, for relation
     * fields, the related model name.
     */
    type: string,
};

export type DatamodelModel = {
    name: string,
    fields: DatamodelField[],
};

export type Datamodel = {
    models: DatamodelModel[],
};

/**
 * What the adapter needs to know about the targeted model. Every
 * question may answer `undefined` for "unknown": the adapter then
 * falls back to its documented default instead of guessing silently.
 */
export interface IMetadata {
    /**
     * Whether the addressed path is a relation rather than a column.
     * A relation accepts only `is`/`isNot`/`some`/`every`/`none`, so a
     * null check on one must be expressed as presence, not as a null
     * comparison.
     */
    isRelation(path: string): boolean | undefined;

    /**
     * Whether the relation addressed by a dotted path is to-many
     * (`some`/`none`) rather than to-one (`is`).
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
     * operator adds a `{ field: null }` arm, and prisma rejects that
     * arm on a required column with a validation error. Known-required
     * fields drop the arm: semantically identical, since no null can
     * exist there.
     */
    isNullable(path: string): boolean | undefined;
}
