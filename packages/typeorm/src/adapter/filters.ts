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

export class FiltersAdapter extends FiltersBaseAdapter<RelationsAdapter> {
    protected queryBuilder : SelectQueryBuilder<any>;

    protected dialect : DialectOptions;

    constructor(queryBuilder: SelectQueryBuilder<any>, relations: RelationsAdapter) {
        super(relations);

        this.queryBuilder = queryBuilder;
        this.dialect = resolveQueryDialect(queryBuilder);
    }

    rootAlias(): string | undefined {
        return this.queryBuilder.alias;
    }

    escapeField(field: string) {
        return this.queryBuilder.escape(field);
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

    override caseFold(input: string) : string {
        if (this.dialect.caseFold) {
            return this.dialect.caseFold(input);
        }

        return super.caseFold(input);
    }

    child(): this {
        const child = new FiltersAdapter(this.queryBuilder, this.relations);

        this.setChildAttributes(child);

        return child as this;
    }

    execute() {
        const [sql, params] = this.getQueryAndParameters();

        this.queryBuilder.where(sql, params);
    }
}
