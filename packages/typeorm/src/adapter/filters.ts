/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError } from '@rapiq/core';
import type { DialectOptions } from '@rapiq/sql';
import { FiltersBaseAdapter } from '@rapiq/sql';
import type { ColumnType, EntityMetadata, SelectQueryBuilder } from 'typeorm';
import { resolveQueryDialect } from '../dialect';
import type { RelationsAdapter } from './relations';

/**
 * Column types whose values are strings and therefore participate in
 * case-insensitive equality folding. Non-string columns never fold —
 * lower() on them is wasted work at best and a type error at worst
 * (e.g. `lower(integer)` on postgres).
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
    'citext',
    'string',
]);

function isCaseFoldableColumnType(type: ColumnType) : boolean {
    if (type === String) {
        return true;
    }

    return typeof type === 'string' && CASE_FOLDABLE_COLUMN_TYPES.has(type);
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

    override isCaseFoldable(field: string) : boolean {
        const { mainAlias } = this.queryBuilder.expressionMap;
        if (!mainAlias || !mainAlias.hasMetadata) {
            return super.isCaseFoldable(field);
        }

        const column = findColumnByPropertyPath(mainAlias.metadata, field);
        if (!column) {
            return super.isCaseFoldable(field);
        }

        return isCaseFoldableColumnType(column.type);
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
