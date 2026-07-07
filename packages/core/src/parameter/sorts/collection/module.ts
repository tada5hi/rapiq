/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ISort } from '../record';
import type { ISorts, ISortsVisitor } from './types';

export class Sorts implements ISorts {
    readonly value: ISort[];

    constructor(value: ISort[] = []) {
        this.value = value;
    }

    accept<R>(visitor: ISortsVisitor<R>) : R {
        return visitor.visitSorts(this);
    }

    /**
     * Keyed by name, left/receiver priority; order = first occurrence.
     * Immutable — returns a new collection.
     */
    merge(other: ISorts) : ISorts {
        const output : ISort[] = [];

        const seen = new Set<string>();
        for (const item of [...this.value, ...other.value]) {
            if (seen.has(item.name)) {
                continue;
            }

            seen.add(item.name);
            output.push(item);
        }

        return new Sorts(output);
    }
}
