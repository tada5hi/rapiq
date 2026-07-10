/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { splitFirst } from '../../helpers';
import type { IRelationsAdapter } from './types';

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

    // -----------------------------------------------------------

    protected constructor() {
        this.value = [];
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
