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

    /**
     * WHERE fragments are raw SQL — the SelectQueryBuilder dropped
     * whole-query property-name replacement with typeorm 1.x, so
     * property paths must resolve to their database column names here.
     */
    override resolveFieldName(name: string, relationPath?: string) : string {
        const { mainAlias } = this.queryBuilder.expressionMap;
        if (!mainAlias || !mainAlias.hasMetadata) {
            return super.resolveFieldName(name, relationPath);
        }

        const path = relationPath ? `${relationPath}.${name}` : name;
        const column = findColumnByPropertyPath(mainAlias.metadata, path);
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
