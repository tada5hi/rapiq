/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FiltersBaseAdapter, pg } from '@rapiq/sql';
import type { SelectQueryBuilder } from 'typeorm';
import type { RelationsAdapter } from './relations';

export class FiltersAdapter<
    QUERY extends SelectQueryBuilder<any> = SelectQueryBuilder<any>,
> extends FiltersBaseAdapter<QUERY> {
    constructor(relations: RelationsAdapter<QUERY>) {
        super(relations);
    }

    rootAlias(): string | undefined {
        // todo: get this.query.connection.options.type -> dialect

        if (this.query) {
            return this.query.alias;
        }

        return undefined;
    }

    escapeField(field: string) {
        return pg.escapeField(field);
    }

    paramPlaceholder(index: number) : string {
        return `:${index - 1}`;
    }

    regexp(field: string, placeholder: string, ignoreCase: boolean): string {
        // todo: get this.query.connection.options.type -> dialect
        return pg.regexp(field, placeholder, ignoreCase);
    }

    child(): this {
        const child = new FiltersAdapter(this.relations);

        this.setChildAttributes(child);

        return child as this;
    }

    execute() {

    }
}
