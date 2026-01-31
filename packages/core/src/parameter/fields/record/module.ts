/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IFieldVisitor } from './types';

export class Field {
    name: string;

    readonly operator: string | undefined;

    constructor(name: string, operator?: string) {
        this.name = name;
        this.operator = operator;
    }

    accept<R>(visitor: IFieldVisitor<R>): R {
        return visitor.visitField(this);
    }
}
