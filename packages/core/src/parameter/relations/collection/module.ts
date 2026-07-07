/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IRelation } from '../record';
import { Relation } from '../record';
import type { IRelations, IRelationsVisitor } from './types';

export class Relations implements IRelations {
    readonly value: IRelation[];

    constructor(value: IRelation[] = []) {
        this.value = value;
    }

    accept<R>(visitor: IRelationsVisitor<R>) : R {
        return visitor.visitRelations(this);
    }

    /**
     * Collect the child relations below a given root
     * (e.g. root "items" yields "realm" for "items.realm").
     *
     * The collection itself is left untouched — parsers share one
     * relations instance across all parameters, so consuming entries
     * here would corrupt the parsed query.
     */
    extract(root: string): IRelations {
        const children: Relations = new Relations();

        const prefix = `${root}.`;
        for (const relation of this.value) {
            if (relation.name.substring(0, prefix.length) === prefix) {
                children.value.push(new Relation(relation.name.substring(prefix.length)));
            }
        }

        return children;
    }

    /**
     * Keyed by name, left/receiver priority; order = first occurrence.
     * Immutable — returns a new collection.
     */
    merge(other: IRelations) : IRelations {
        const output : IRelation[] = [];

        const seen = new Set<string>();
        for (const item of [...this.value, ...other.value]) {
            if (seen.has(item.name)) {
                continue;
            }

            seen.add(item.name);
            output.push(item);
        }

        return new Relations(output);
    }
}
