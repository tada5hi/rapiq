/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ParamPlaceholderIndexer, splitLast } from '../../helpers';
import type { RelationsContainer } from '../relations/module';

export abstract class FiltersAbstractContainer<
    QUERY extends Record<string, any> = Record<string, any>,
> {
    /**
     * where conditions
     *
     * e.g. ['"foo.bar" = "1"' ]
     */
    conditions: string[];

    params : unknown[];

    protected relations: RelationsContainer<QUERY>;

    protected paramPlaceholderIndexer : ParamPlaceholderIndexer;

    protected fieldPrefix: string;

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsContainer<QUERY>,
    ) {
        this.conditions = [];
        this.params = [];

        this.relations = relations;

        this.paramPlaceholderIndexer = new ParamPlaceholderIndexer();
        this.fieldPrefix = '';
    }

    // -----------------------------------------------------------

    withQuery(query?: QUERY) {
        this.query = query;
        return this;
    }

    // -----------------------------------------------------------

    clear() {
        this.conditions = [];
        this.params = [];

        this.fieldPrefix = '';
    }

    // -----------------------------------------------------------

    apply() {
        // todo: try to apply single where clause, with parameters
    }

    applyAll() {
        // todo: apply all where clauses with parameters
    }

    abstract rootAlias() : string | undefined;

    abstract paramPlaceholder(index: number) : string;

    abstract escapeField(field: string) : string;

    abstract regexp(field: string, placeholder: string, ignoreCase: boolean) : string;

    abstract child() : this;

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

    buildField(input: string, rootAlias?: string) {
        let inputNormalized : string;

        if (this.fieldPrefix) {
            inputNormalized = this.fieldPrefix + input;
        } else {
            inputNormalized = input;
        }

        rootAlias ??= this.rootAlias();

        const [relation, name] = splitLast(inputNormalized);
        if (!name) {
            if (rootAlias) {
                return `${this.escapeField(rootAlias)}.${this.escapeField(relation)}`;
            }

            return this.escapeField(relation);
        }

        if (!this.relations.has(relation)) {
            const joined = this.relations.add(relation, rootAlias);
            if (!joined) {
                return this.escapeField(name);
            }
        }

        const [first, last] = splitLast(relation);
        if (last) {
            return `${this.escapeField(last)}.${this.escapeField(name)}`;
        }

        return `${this.escapeField(first)}.${this.escapeField(name)}`;
    }

    // -----------------------------------------------------------

    merge<
        T extends FiltersAbstractContainer<QUERY>,
    >(
        query: T,
        operator: 'and' | 'or' = 'and',
        isInverted : boolean = false,
    ) : this {
        if (query.conditions.length > 0) {
            let sql = query.conditions.join(` ${operator} `);

            if (sql[0] !== '(') {
                sql = `(${sql})`;
            }

            this.conditions.push(`${isInverted ? 'not ' : ''}${sql}`);
            this.params.push(...query.params);
        }

        return this;
    }

    protected setChildAttributes<
        T extends FiltersAbstractContainer<QUERY>,
    >(child: T) : T {
        child.withQuery(this.query);
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
