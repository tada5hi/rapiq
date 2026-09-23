/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, toDate } from '@rapiq/core';
import type { DialectOptions, TemporalKind } from '@rapiq/adapter-sql';
import { FiltersBaseAdapter } from '@rapiq/adapter-sql';
import type { ColumnType, EntityMetadata, SelectQueryBuilder } from 'typeorm';
import { DateUtils } from 'typeorm';
import { resolveQueryDialect } from '../dialect';
import type { RelationsAdapter } from './relations';

/**
 * Column types whose values are strings and therefore participate in
 * case-insensitive folding (the equality family and the anchored
 * operators). Non-string columns never fold: lower() on them is wasted
 * work at best and a type error at worst (e.g. `lower(integer)` on
 * postgres).
 *
 * `citext` is deliberately absent although it is a string type: its own
 * comparison and LIKE operators are already case-insensitive, so folding
 * it only discards the citext index.
 */
const CASE_FOLDABLE_COLUMN_TYPES = new Set<string>([
    'varchar', 
    'character varying', 
    'varying character', 
    'char varying',
    'nvarchar', 
    'national varchar',
    'char', 
    'nchar', 
    'national char', 
    'character', 
    'native character',
    'text', 
    'tinytext', 
    'mediumtext', 
    'longtext', 
    'ntext', 
    'string',
    // typeorm stores these as text and hydrates them itself, so a
    // filter on one compares against the stored string
    'simple-array',
    'simple-json',
    'simple-enum',
]);

function isCaseFoldableColumnType(type: ColumnType) : boolean {
    if (type === String) {
        return true;
    }

    return typeof type === 'string' && CASE_FOLDABLE_COLUMN_TYPES.has(type);
}

/**
 * Column types a `sum` aggregate accepts on every dialect that declares
 * them. Booleans are absent: pg has no `sum(boolean)`, so summing one
 * would pass here and fail inside the database.
 */
const NUMERIC_COLUMN_TYPES = new Set<string>([
    'tinyint',
    'smallint',
    'mediumint',
    'int',
    'int2',
    'int4',
    'int8',
    'int64',
    'integer',
    'bigint',
    'unsigned big int',
    'dec',
    'decimal',
    'smalldecimal',
    'fixed',
    'numeric',
    'number',
    'float',
    'float4',
    'float8',
    'float64',
    'double',
    'double precision',
    'real',
    'money',
    'smallmoney',
]);

function isNumericColumnType(type: ColumnType) : boolean {
    if (type === Number) {
        return true;
    }

    return typeof type === 'string' && NUMERIC_COLUMN_TYPES.has(type);
}

/**
 * How a date operand has to be spelled for the column it addresses.
 * A column absent from every table is not temporal and binds as-is.
 */
const DATE_COLUMN_FORMATS : Record<string, TemporalKind> = {
    // a calendar day, no clock
    'date': 'date',

    // wall clock without an offset: the stored value carries no zone,
    // so the operand must be spelled in the same zone it was written
    // in. Binding a `Date` instead is what the pg and mysql drivers
    // then serialize in the HOST's local zone, shifting the window by
    // the host's offset on any non-UTC machine.
    'datetime': 'datetime',
    'datetime2': 'datetime',
    'smalldatetime': 'datetime',
    'timestamp': 'datetime',
    'timestamp without time zone': 'datetime',

    // zone-aware: the instant itself round-trips
    'datetimeoffset': 'instant',
    'timestamptz': 'instant',
    'timestamp with time zone': 'instant',
    'timestamp with local time zone': 'instant',
};

/**
 * A bare calendar date, the form a date-only column stores and the
 * form a client sends for one.
 */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `uniqueidentifier` is the mssql spelling; typeorm keeps whichever
 * one the column was declared with.
 */
const UUID_COLUMN_TYPES = new Set<string>(['uuid', 'uniqueidentifier']);

/**
 * Exactly the spellings postgres' `uuid_in` reads: 32 hex digits, a
 * hyphen optional after any group of four, the whole optionally in
 * one pair of braces.
 */
const UUID_INPUT = /^(?:\{[0-9a-f]{4}(?:-?[0-9a-f]{4}){7}\}|[0-9a-f]{4}(?:-?[0-9a-f]{4}){7})$/i;

/**
 * Spell a uuid operand in the canonical form postgres outputs and
 * typeorm generates (hyphenated, lowercase), or undefined when it is
 * no uuid at all. Normalizing rather than refusing keeps every spelling
 * postgres accepts working there, and makes it match on sqlite, whose
 * text column compares case-sensitively (mysql's collation does not).
 */
function toCanonicalUuid(value: unknown) : string | undefined {
    if (typeof value !== 'string' || !UUID_INPUT.test(value)) {
        return undefined;
    }

    const hex = value.replace(/[{}-]/g, '').toLowerCase();

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function resolveDateColumnFormat(type: ColumnType) : TemporalKind | undefined {
    if (type === Date) {
        return 'datetime';
    }

    if (typeof type !== 'string') {
        return undefined;
    }

    return DATE_COLUMN_FORMATS[type];
}

/**
 * TypeORM parameters are global to the query builder and last-write-wins,
 * so every filter application needs its own namespace: positional names
 * like `:0` would silently rebind a caller-owned `:0` parameter — or, on
 * a re-run, the previous run's clauses.
 */
let PARAM_NAMESPACE_SEQ = 0;

function nextParamNamespace() : string {
    PARAM_NAMESPACE_SEQ += 1;

    return `rapiq_${PARAM_NAMESPACE_SEQ}_`;
}

/**
 * Resolve a (possibly relation-dotted) property path to its column,
 * descending through relation metadata segment by segment; embedded
 * paths resolve through the plain column lookup per step.
 */
function findColumnByPropertyPath(metadata: EntityMetadata, path: string) {
    let current = metadata;
    const segments = path.split('.');

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        if (!segment) {
            return undefined;
        }

        const column = current.findColumnWithPropertyPath(segments.slice(i).join('.'));
        if (column) {
            return column;
        }

        const relation = current.findRelationWithPropertyPath(segment);
        if (!relation) {
            return undefined;
        }

        current = relation.inverseEntityMetadata;
    }

    return undefined;
}

export class FiltersAdapter extends FiltersBaseAdapter<RelationsAdapter> {
    protected queryBuilder : SelectQueryBuilder<any>;

    protected dialect : DialectOptions;

    protected paramNamespace : string;

    constructor(queryBuilder: SelectQueryBuilder<any>, relations: RelationsAdapter) {
        super(relations);

        this.queryBuilder = queryBuilder;
        this.dialect = resolveQueryDialect(queryBuilder);
        this.paramNamespace = nextParamNamespace();
    }

    override clear() {
        super.clear();

        // a fresh namespace per run: clauses a previous run left on the
        // builder keep their own bindings instead of being rebound.
        this.paramNamespace = nextParamNamespace();
    }

    rootAlias(): string | undefined {
        return this.queryBuilder.alias;
    }

    escapeField(field: string) {
        return this.queryBuilder.escape(field);
    }

    paramPlaceholder(index: number) : string {
        return `:${this.paramNamespace}${index - 1}`;
    }

    override isRegexpSupported() : boolean {
        return typeof this.dialect.regexp !== 'undefined';
    }

    regexp(field: string, placeholder: string, ignoreCase: boolean): string {
        if (this.dialect.regexp) {
            return this.dialect.regexp(field, placeholder, ignoreCase);
        }

        throw AdapterError.featureUnsupported('regexp');
    }

    override mod(field: string, divisorPlaceholder: string, remainderPlaceholder: string): string {
        if (this.dialect.mod) {
            return this.dialect.mod(field, divisorPlaceholder, remainderPlaceholder);
        }

        throw AdapterError.featureUnsupported('filters:mod');
    }

    override castText(input: string, field?: string) : string {
        const { mainAlias } = this.queryBuilder.expressionMap;
        // citext is not case-foldable because its native LIKE already folds.
        // Casting it to text would silently make matching case-sensitive.
        if (field && mainAlias?.hasMetadata && findColumnByPropertyPath(mainAlias.metadata, field)?.type === 'citext') {
            return input;
        }
        return this.dialect.castText?.(input) ?? super.castText(input);
    }

    override caseFold(input: string) : string {
        if (this.dialect.caseFold) {
            return this.dialect.caseFold(input);
        }

        return super.caseFold(input);
    }

    override caseFoldLike(input: string) : string {
        if (this.dialect.caseFoldLike) {
            return this.dialect.caseFoldLike(input);
        }

        return this.caseFold(input);
    }

    override isLikeBracketWildcard() : boolean {
        return !!this.dialect.likeBracketWildcard;
    }

    /**
     * The column a (possibly relation-dotted) property path addresses,
     * or undefined when the builder carries no entity metadata or the
     * path resolves to none.
     */
    protected resolveColumn(path: string) {
        const { mainAlias } = this.queryBuilder.expressionMap;
        if (!mainAlias || !mainAlias.hasMetadata) {
            return undefined;
        }

        return findColumnByPropertyPath(mainAlias.metadata, path);
    }

    override isCaseFoldable(field: string) : boolean {
        const column = this.resolveColumn(field);
        if (!column) {
            return super.isCaseFoldable(field);
        }

        return isCaseFoldableColumnType(column.type);
    }

    /**
     * How a bucketed column stores time, read from the entity
     * metadata: a zone-aware column is truncated as an instant in UTC,
     * a date-only column as a calendar day. A column that is not
     * temporal answers undefined, which the grouped clauses refuse
     * typed (`groups:bucket-type`). A builder without metadata, or a
     * path it cannot resolve, keeps the base default.
     */
    override temporalKind(field: string) : TemporalKind | undefined {
        const column = this.resolveColumn(field);
        if (!column) {
            return super.temporalKind(field);
        }

        return resolveDateColumnFormat(column.type);
    }

    /**
     * Whether a summed column holds numbers, read from the entity
     * metadata: the grouped clauses refuse any other column typed
     * (`aggregates:sum-type`) instead of letting the database fail
     * (pg has no `sum(character varying)`). A builder without metadata,
     * or a path it cannot resolve, keeps the base default.
     */
    override isNumeric(field: string) : boolean {
        const column = this.resolveColumn(field);
        if (!column) {
            return super.isNumeric(field);
        }

        return isNumericColumnType(column.type);
    }

    /**
     * Bind a date operand in the form its column stores, so the
     * comparison happens between two values of the same shape. A wire
     * value reaches the adapter as whatever a query string can carry,
     * and the column's transformer runs on read only, so binding it
     * unchanged compares an ISO string against the driver's own
     * storage format: on sqlite the two differ on the `' '`/`'T'`
     * byte, which inverts every range comparison.
     *
     * A zone-less column is written in UTC (what typeorm's sqlite
     * driver does unconditionally, and what a UTC-configured
     * connection does elsewhere), so that is the zone the operand is
     * spelled in.
     */
    override bindValue(field: string, value: unknown) : unknown {
        if (value === null || typeof value === 'undefined') {
            return value;
        }

        const column = this.resolveColumn(field);
        if (!column) {
            return value;
        }

        if (typeof column.type === 'string' && UUID_COLUMN_TYPES.has(column.type)) {
            // postgres and mssql fail the whole query on a malformed
            // uuid, while sqlite and mysql store it as text and match
            // nothing: refuse it here so every dialect answers with the
            // same client error.
            const uuid = toCanonicalUuid(value);
            if (!uuid) {
                throw AdapterError.keyValueInvalid(field);
            }

            return uuid;
        }

        const format = resolveDateColumnFormat(column.type);
        if (!format) {
            return value;
        }

        const date = toDate(value);
        if (!date) {
            // a malformed date would otherwise reach the driver, which
            // answers a bad client value with a server error.
            throw AdapterError.keyValueInvalid(field);
        }

        if (format === 'instant') {
            return date.toISOString();
        }

        if (format === 'date') {
            // a calendar date needs no conversion at all, and must not
            // get one: `mixedDateToDateString` reads local calendar
            // parts unless the column opts into `utc`, so a round trip
            // through an instant (UTC midnight) lands on the previous
            // day on any negative-offset host. `toDate` above still
            // ran, so an impossible day was already refused.
            if (typeof value === 'string' && CALENDAR_DATE.test(value)) {
                return value;
            }

            // an operand that does carry a clock has to pick a day:
            // mirror `utc`, the option typeorm writes the column with.
            return DateUtils.mixedDateToDateString(date, { utc: column.utc });
        }

        return DateUtils.mixedDateToUtcDatetimeString(date);
    }

    /**
     * WHERE fragments are raw SQL built from escaped identifiers
     * (`"user"."realm_id"`). typeorm's whole-query property-name
     * replacement only rewrites an unescaped `alias.property`, so it
     * never reaches them, and property paths must resolve to their
     * database column names here.
     */
    override resolveFieldName(name: string, relationPath?: string) : string {
        const column = this.resolveColumn(relationPath ? `${relationPath}.${name}` : name);
        if (!column) {
            return super.resolveFieldName(name, relationPath);
        }

        return column.databaseName;
    }

    child(): this {
        const child = new FiltersAdapter(this.queryBuilder, this.relations);

        this.setChildAttributes(child);
        // children share the placeholder indexer, so they must also
        // share the namespace their placeholders are rendered with.
        child.paramNamespace = this.paramNamespace;

        return child as this;
    }

    override execute() {
        const [sql, params] = this.getQueryAndParameters();

        if (sql) {
            const parameters : Record<string, unknown> = {};
            for (const [i, param] of params.entries()) {
                parameters[`${this.paramNamespace}${i}`] = param;
            }

            // The builder may already carry an application-owned predicate
            // (for example a tenant or authorization scope). Rapiq filters
            // narrow that query; they must never replace its baseline WHERE.
            this.queryBuilder.andWhere(sql, parameters);
        }
    }
}
