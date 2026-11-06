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
     * Whether the field addressed by a dotted path holds a date, so a
     * value that crossed the untyped wire as a string has to be read
     * back as the instant it denotes before prisma sees it.
     *
     * Optional: an implementation that does not answer leaves date
     * operands untouched, which is what this adapter did before the
     * question existed.
     */
    isDate?(path: string): boolean | undefined;

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

/**
 * Anything a datamodel can be read from:
 *
 * - `Prisma.dmmf.datamodel` (models as an array), or any hand-written
 *   object of the same shape,
 * - `client.$datamodel` / `client._runtimeDataModel` (models as a
 *   record keyed by name),
 * - a `PrismaClient` instance, which carries the latter.
 *
 * The client paths prefer the public `$datamodel` reflection surface
 * (proposed in prisma/prisma#19392, implemented by prisma/prisma#29792)
 * and fall back to `_runtimeDataModel`, a private but long-stable
 * client internal verified against real generated clients by the
 * engine-backed test suite. The datamodel shapes are the
 * private-API-free path.
 */
export type DatamodelInput = Datamodel | object;

/**
 * A model delegate (`prisma.user`), or a plain model name (`'User'`).
 * The delegate resolves through its public field references, with the
 * runtime `$name` marker as the primary source.
 */
export type ModelInput = string | { fields: object };
