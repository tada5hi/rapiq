/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { RelationAliasFn } from '../../helpers';
import { buildRelationAlias, splitFirst } from '../../helpers';
import type { IRelationsAdapter, RelationsAdapterBaseOptions } from './types';

export abstract class RelationsBaseAdapter implements IRelationsAdapter {
    /**
     * joins
     *
     * [alias].project.user.name
     *
     * JOIN xxx.yyy as yyy
     *
     * { path: "xxx.zzz", name: "zzz" }[]
     * @protected
     */
    protected value : {
        path: string,
        name: string,
        executed?: boolean
    }[];

    protected relationAlias : RelationAliasFn;

    // -----------------------------------------------------------

    protected constructor(options: RelationsAdapterBaseOptions = {}) {
        this.value = [];
        this.relationAlias = options.relationAlias ?? buildRelationAlias;
    }

    // -----------------------------------------------------------

    /**
     * Join alias for a relation path (e.g. `role.realm` ->
     * `r4_role_5_realm`).
     * The single derivation point shared by join application and the
     * field references built by the fields/filters/sort adapters.
     */
    buildAlias(path: string) : string {
        return this.relationAlias(path);
    }

    // -----------------------------------------------------------

    clear() {
        this.value = [];
    }

    // -----------------------------------------------------------

    abstract execute() : void;

    // -----------------------------------------------------------

    add(relation: string) {
        if (this.has(relation)) {
            return true;
        }

        let path : string | undefined;
        let last : string | undefined = relation;

        while (last) {
            let relationName: string;
            [relationName, last] = splitFirst(last);

            path = path ?
                `${path}.${relationName}` :
                relationName;

            if (this.has(path)) {
                continue;
            }

            this.value.push({
                path,
                name: relationName,
            });
        }

        return true;
    }

    has(name: string) {
        return this.value.some((join) => join.path === name);
    }

    /**
     * Canonical relation paths (parents included), e.g. ['items', 'items.realm'].
     */
    getPaths() : string[] {
        return this.value.map((join) => join.path);
    }
}
