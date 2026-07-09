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
    protected queryBuilder : SelectQueryBuilder<any> | undefined;

    protected dialect : DialectOptions;

    constructor(queryBuilder: SelectQueryBuilder<any> | undefined, relations: RelationsAdapter) {
        super(relations);

        this.queryBuilder = queryBuilder;
        this.dialect = resolveQueryDialect(queryBuilder);
    }

    rootAlias(): string | undefined {
        if (this.queryBuilder) {
            return this.queryBuilder.alias;
        }

        return undefined;
    }

    escapeField(field: string) {
        if (this.queryBuilder) {
            return this.queryBuilder.escape(field);
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
        const child = new FiltersAdapter(this.queryBuilder, this.relations);

        this.setChildAttributes(child);

        return child as this;
    }

    execute() {
        const [sql, params] = this.getQueryAndParameters();

        if (this.queryBuilder) {
            this.queryBuilder.where(sql, params);
        }
    }
}
