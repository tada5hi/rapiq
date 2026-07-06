/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '@rapiq/core';
import type { DialectOptions } from '@rapiq/sql';
import { FiltersBaseAdapter } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import { resolveQueryDialect } from '../dialect';
import type { RelationsAdapter } from './relations';

export class FiltersAdapter<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> extends FiltersBaseAdapter<QUERY, RelationsAdapter<QUERY>> {
    protected dialect : DialectOptions;

    constructor(relations: RelationsAdapter<QUERY>) {
        super(relations);

        this.dialect = resolveQueryDialect();
    }

    override withQuery(query?: QUERY) {
        this.dialect = resolveQueryDialect(query);

        return super.withQuery(query);
    }

    rootAlias(): string | undefined {
        if (this.query) {
            return this.query.alias;
        }

        return undefined;
    }

    escapeField(field: string) {
        if (this.query) {
            return this.query.escape(field);
        }

        return this.dialect.escapeField(field);
    }

    paramPlaceholder(index: number) : string {
        return `:${index - 1}`;
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

    child(): this {
        const child = new FiltersAdapter(this.relations);

        this.setChildAttributes(child);

        return child as this;
    }

    execute() {
        const [sql, params] = this.getQueryAndParameters();

        if (this.query) {
            this.query.where(sql, params);
        }
    }
}
