/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Relation } from '../record';
import type { IRelationsVisitor } from './types';

export class Relations {
    readonly value: Relation[];

    constructor(value: Relation[] = []) {
        this.value = value;
    }

    accept<R>(visitor: IRelationsVisitor<R>) : R {
        return visitor.visitRelations(this);
    }

    extract(root: string): Relations {
        const removed: Relations = new Relations();

        for (let i = this.value.length - 1; i >= 0; i--) {
            if (this.value[i].name === root) {
                this.value.splice(i, 1);
                continue;
            }

            if (this.value[i].name.substring(0, root.length) === root) {
                removed.value.push(new Relation(this.value[i].name.substring(root.length + 1)));
                this.value.splice(i, 1);
            }
        }

        return removed;
    }
}
