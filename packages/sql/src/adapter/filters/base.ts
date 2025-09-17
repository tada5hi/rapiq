/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { ParamPlaceholderIndexer, parseField } from '../../helpers';
import type { RelationsBaseAdapter } from '../relations';
import type { IFiltersAdapter } from './types';

export abstract class FiltersBaseAdapter<
    QUERY extends Record<string, any> = Record<string, any>,
> implements IFiltersAdapter<QUERY> {
    /**
     * where conditions
     *
     * e.g. ['"foo.bar" = "1"' ]
     */
    conditions: string[];

    params : unknown[];

    protected relations: RelationsBaseAdapter<QUERY>;

    protected paramPlaceholderIndexer : ParamPlaceholderIndexer;

    protected fieldPrefix: string;

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    protected constructor(
        relations: RelationsBaseAdapter<QUERY>,
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

        this.paramPlaceholderIndexer.reset();
        this.fieldPrefix = '';
    }

    // -----------------------------------------------------------

    // todo: try to apply single where clause, with parameters

    protected abstract rootAlias() : string | undefined;

    protected abstract paramPlaceholder(index: number) : string;

    protected abstract escapeField(field: string) : string;

    abstract regexp(field: string, placeholder: string, ignoreCase: boolean) : string;

    abstract execute(): void;

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

    buildField(input: string, rootAlias?: string) : string {
        let inputNormalized : string;

        if (this.fieldPrefix) {
            inputNormalized = this.fieldPrefix + input;
        } else {
            inputNormalized = input;
        }

        rootAlias ??= this.rootAlias();

        const output = parseField(inputNormalized, rootAlias);
        if (output.relation) {
            this.relations.add(output.relation);
        }

        if (output.prefix) {
            return `${this.escapeField(output.prefix)}.${this.escapeField(output.name)}`;
        }

        return this.escapeField(output.name);
    }

    // -----------------------------------------------------------

    merge<
        T extends IFiltersAdapter<QUERY>,
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
        T extends FiltersBaseAdapter<QUERY>,
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
