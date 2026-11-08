export type VisitorOptions = {
    /**
     * Field keys whose equality (eq/ne/in/nin) and anchored
     * (startsWith/endsWith/contains) comparisons stay
     * case-sensitive instead of the case-insensitive default, e.g.
     * identifier or token columns; `true` opts every field out.
     * Typically forwarded from a schema's `filters.caseSensitive`
     * list.
     */
    caseSensitive?: string[] | boolean,

    [key: string]: any;
};

export type FieldsInterpreterOptions = VisitorOptions;

export type PaginationVisitorOptions = VisitorOptions;

export type RelationsInterpreterOptions = VisitorOptions;

/**
 * @deprecated use {@link RelationsInterpreterOptions}. Removed in 3.0.
 */
export type RelationInterpreterOptions = RelationsInterpreterOptions;

export type SortsInterpreterOptions = VisitorOptions;

/**
 * @deprecated use {@link SortsInterpreterOptions}. Removed in 3.0.
 */
export type SortInterpreterOptions = SortsInterpreterOptions;
