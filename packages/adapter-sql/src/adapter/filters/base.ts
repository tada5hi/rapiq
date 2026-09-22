/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ITSELF } from '@rapiq/core';
import type { TemporalKind } from '../../dialect';
import { ParamPlaceholderIndexer, parseField } from '../../helpers';
import type { IRelationsAdapter } from '../relations';
import type { IFiltersAdapter } from './types';

export abstract class FiltersBaseAdapter<
    RelationsAdapter extends IRelationsAdapter = IRelationsAdapter,
> implements IFiltersAdapter {
    /**
     * where conditions
     *
     * e.g. ['"foo.bar" = "1"' ]
     */
    conditions: string[];

    params : unknown[];

    protected relations: RelationsAdapter;

    protected paramPlaceholderIndexer : ParamPlaceholderIndexer;

    protected fieldPrefix: string;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsAdapter,
    ) {
        this.conditions = [];
        this.params = [];

        this.relations = relations;

        this.paramPlaceholderIndexer = new ParamPlaceholderIndexer();
        this.fieldPrefix = '';
    }

    // -----------------------------------------------------------

    clear() {
        this.conditions = [];
        this.params = [];

        this.paramPlaceholderIndexer.reset();
        this.fieldPrefix = '';
    }

    // -----------------------------------------------------------

    protected abstract rootAlias() : string | undefined;

    protected abstract paramPlaceholder(index: number) : string;

    protected abstract escapeField(field: string) : string;

    abstract regexp(field: string, placeholder: string, ignoreCase: boolean) : string;

    /**
     * Build a modulo-equality condition. The universal SQL-92 default
     * (`mod(field, divisor) = remainder`); dialects without a matching
     * `MOD()` function override this (see `@rapiq/adapter-sql`'s
     * `FiltersAdapter`, which consults `DialectOptions.mod` and throws a
     * typed `filters:mod` refusal when the active dialect omits it).
     */
    mod(field: string, divisorPlaceholder: string, remainderPlaceholder: string) : string {
        return `mod(${field}, ${divisorPlaceholder}) = ${remainderPlaceholder}`;
    }

    /**
     * Apply the accumulated state to a backend target.
     * Fragment-emitting backends have nothing to apply.
     */
    execute(): void {}

    abstract child() : this;

    /**
     * Whether the dialect can build regular-expression conditions,
     * i.e. whether the `regex` operator is available. The anchored
     * operators render as LIKE regardless.
     */
    isRegexpSupported() : boolean {
        return true;
    }

    /**
     * Fold an expression for a case-insensitive equality comparison
     * (eq/ne/in/nin on strings). Dialects whose plain `=` already
     * compares case-insensitively return the input unchanged.
     */
    caseFold(input: string) : string {
        return `lower(${input})`;
    }

    /**
     * Fold an expression for a case-insensitive LIKE comparison
     * (the anchored operators). Defaults to the equality fold;
     * dialects whose LIKE already compares case-insensitively while
     * their `=` does not (sqlite) return the input unchanged, which
     * keeps the pattern prefix index-usable.
     */
    caseFoldLike(input: string) : string {
        return this.caseFold(input);
    }

    /**
     * Whether `[` has to be escaped in a LIKE pattern, i.e. whether it
     * opens a character range in this dialect (MSSQL).
     */
    isLikeBracketWildcard() : boolean {
        return false;
    }

    /** Convert a known non-string LIKE operand; default to implicit coercion. */
    castText(input: string, _field?: string) : string {
        return input;
    }

    /**
     * Whether equality comparisons on this field may case-fold at all.
     * Backends with column metadata override this to exempt non-string
     * columns — folding them is wasted work at best and a type error at
     * worst (e.g. `lower(integer)` on postgres).
     */
    isCaseFoldable(_field: string) : boolean {
        return true;
    }

    /**
     * Prepare an operand for binding against the field it is compared
     * to. The wire is untyped, so a value crosses it in whatever form
     * a query string can carry; a backend that knows the column's type
     * overrides this to bind the form that column actually stores
     * (a date literal rather than the client's ISO string, say), and
     * refuses an operand it cannot bind with a typed `AdapterError`
     * instead of letting the driver answer with a server error.
     *
     * Only equality and ordering operands pass through here: a LIKE
     * pattern or a modulo divisor is not compared against the column's
     * own domain.
     */
    bindValue(_field: string, value: unknown) : unknown {
        return value;
    }

    /**
     * How a column stores a temporal value. Standalone SQL has no column
     * metadata, so every column reads as a zone-less `datetime`. A pg
     * `timestamptz` column would then bucket in the session time zone:
     * backends with metadata override this, a standalone caller assigns
     * `adapter.filters.temporalKind` on the instance for such columns.
     */
    temporalKind(_field: string) : TemporalKind | undefined {
        return 'datetime';
    }

    /**
     * Resolve a parsed field name to the identifier the database knows.
     * Backends with column metadata override this to map property names
     * to column names (e.g. `realmId` -> `realm_id`); the default is the
     * identity, matching schemaless SQL usage.
     *
     * @param name last path segment (property name)
     * @param relationPath dotted relation prefix, if any
     */
    resolveFieldName(name: string, _relationPath?: string) : string {
        return name;
    }

    // -----------------------------------------------------------

    where(field: string, operator: string, value?: unknown) {
        return this.whereRaw(
            `${this.buildField(field)} ${operator} ${this.buildParamPlaceholder()}`,
            value,
        );
    }

    whereRaw(sql: string, ...values: unknown[]) {
        this.conditions.push(sql);

        if (values) {
            this.params.push(...values);
        }

        return this;
    }

    // -----------------------------------------------------------

    buildParamPlaceholder() : string {
        return this.paramPlaceholder(this.paramPlaceholderIndexer.next());
    }

    buildParamsPlaceholders(input: unknown[]) : string[] {
        return input.map(
            (_) => this.paramPlaceholder(this.paramPlaceholderIndexer.next()),
        );
    }

    // -----------------------------------------------------------

    buildField(input: string) : string {
        let inputNormalized : string;

        if (this.fieldPrefix) {
            inputNormalized = this.fieldPrefix + input;
        } else {
            inputNormalized = input;
        }

        // the ITSELF marker references an array element itself —
        // a joined relation row is not a scalar column, so SQL has
        // no rendering for it (dialect JSON support may follow).
        if (inputNormalized.split('.').includes(ITSELF)) {
            throw AdapterError.featureUnsupported('filters:itself');
        }

        const output = parseField(
            inputNormalized,
            this.rootAlias(),
            (path) => this.relations.buildAlias(path),
            (path) => this.relations.isRelationPath(path),
        );
        if (output.relation) {
            this.relations.add(output.relation);
        }

        const name = this.resolveFieldName(output.name, output.relation);

        if (output.prefix) {
            return `${this.escapeField(output.prefix)}.${this.escapeField(name)}`;
        }

        return this.escapeField(name);
    }

    // -----------------------------------------------------------

    merge<
        T extends IFiltersAdapter,
    >(
        query: T,
        operator: 'and' | 'or' = 'and',
        isInverted : boolean = false,
    ) : this {
        if (query.conditions.length > 0) {
            let sql = query.conditions.join(` ${operator} `);

            // single conditions are atomic terms or already wrapped compounds;
            // a leading '(' says nothing about the whole expression
            // (e.g. '(a or b) or c'), so wrap by condition count.
            if (query.conditions.length > 1) {
                sql = `(${sql})`;
            }

            if (isInverted) {
                // group negation is the exact complement of the group
                // verdict (null-inclusive complement law). A bare
                // `not (…)` follows three-valued logic and drops rows
                // where the interior is UNKNOWN (null comparisons); the
                // CASE wrapper collapses UNKNOWN to false first and is
                // portable across all shipped dialects.
                sql = `case when ${sql} then 1 else 0 end = 0`;
            }

            this.conditions.push(sql);
            this.params.push(...query.params);
        }

        return this;
    }

    protected setChildAttributes<
        T extends FiltersBaseAdapter,
    >(child: T) : T {
        child.setFieldPrefix(this.fieldPrefix);
        child.setLastPlaceholderIndexer(this.paramPlaceholderIndexer);

        return child;
    }

    // -----------------------------------------------------------

    setLastPlaceholderIndexer(input: ParamPlaceholderIndexer) {
        this.paramPlaceholderIndexer = input;
    }

    // -----------------------------------------------------------

    getFieldPrefix(): string {
        return this.fieldPrefix;
    }

    setFieldPrefix(prefix: string) {
        this.fieldPrefix = prefix;
    }

    // -----------------------------------------------------------

    getQuery(): string {
        return this.conditions.join(' and ');
    }

    getQueryAndParameters(): [string, unknown[]] {
        return [
            this.getQuery(),
            this.params,
        ];
    }
}
