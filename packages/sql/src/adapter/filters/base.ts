/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ITSELF } from '@rapiq/core';
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

    abstract execute(): void;

    abstract child() : this;

    /**
     * Whether the dialect can build regular-expression conditions.
     * Anchored operators fall back to LIKE otherwise.
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
     * Whether equality comparisons on this field may case-fold at all.
     * Backends with column metadata override this to exempt non-string
     * columns — folding them is wasted work at best and a type error at
     * worst (e.g. `lower(integer)` on postgres).
     */
    isCaseFoldable(_field: string) : boolean {
        return true;
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

        const output = parseField(inputNormalized, this.rootAlias(), (path) => this.relations.buildAlias(path));
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

            this.conditions.push(`${isInverted ? 'not ' : ''}${sql}`);
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
