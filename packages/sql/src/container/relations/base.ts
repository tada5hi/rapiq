/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { splitFirst } from '../../helpers';

export abstract class AbstractRelationsContainer<
    QUERY extends Record<string, any> = Record<string, any>,
> {
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
    protected items : {
        path: string,
        name: string,
        executed?: boolean
    }[];

    protected query : QUERY | undefined;

    // -----------------------------------------------------------

    protected constructor() {
        this.items = [];
    }

    // -----------------------------------------------------------

    apply(rootAlias?: string) : boolean {
        if (!this.query) {
            return true;
        }

        // todo: mark items applied
        for (let i = 0; i < this.items.length; i++) {
            // todo: sub paths might already applied ...
            this.join(this.items[i].path, rootAlias);
        }

        return true;
    }

    abstract join(relation: string, rootAlias?: string) : boolean;

    // -----------------------------------------------------------

    withQuery(query?: QUERY) {
        this.query = query;
        return this;
    }

    // -----------------------------------------------------------

    add(relation: string, alias?: string) {
        const joined = this.join(relation, alias);
        if (!joined) {
            return false;
        }

        let path : string | undefined;
        let last : string | undefined = relation;

        while (last) {
            let relationName: string;
            [relationName, last] = splitFirst(last);

            path = path ?
                `${path}.${relationName}` :
                relationName;

            this.items.push({
                path,
                name: relationName,
            });
        }

        return true;
    }

    has(name: string) {
        return this.items.some((join) => join.path === name);
    }
}
