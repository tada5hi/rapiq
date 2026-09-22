/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { CallLowering } from '../../call';
import type { GroupOptions, IGroup, IGroupVisitor } from './types';

export class Group implements IGroup {
    readonly key: string;

    readonly name: string;

    readonly params: readonly string[];

    readonly lowering: CallLowering | undefined;

    constructor(options: GroupOptions) {
        this.name = options.name;
        this.params = options.params || [];
        this.lowering = options.lowering;

        // a group callee is one dimension: two groups with the same
        // callee are two grains of it, a real collision.
        this.key = options.name;
    }

    accept<R>(visitor: IGroupVisitor<R>) : R {
        return visitor.visitGroup(this);
    }
}
