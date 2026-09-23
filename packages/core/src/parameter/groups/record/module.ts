/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { CallLowering } from '../../call';
import { GroupFunction } from '../../call/constants';
import type { GroupOptions, IGroup, IGroupVisitor } from './types';

export class Group implements IGroup {
    readonly key: string;

    readonly name: string;

    readonly params: readonly string[];

    readonly lowering: CallLowering | undefined;

    constructor(options: GroupOptions) {
        this.name = options.name;
        this.params = [...(options.params ?? [])];
        this.lowering = options.lowering;

        // a group is keyed by its column: bucket(createdAt,day) and a named
        // period(day) over createdAt are both createdAt. A column is grouped
        // at most once, so this is unique. An unresolved named term does not
        // know its column until a server parse resolves it, and keeps its name.
        this.key = options.lowering?.field ??
            ((this.name === GroupFunction.BUCKET && this.params[0]) || this.name);
    }

    accept<R>(visitor: IGroupVisitor<R>) : R {
        return visitor.visitGroup(this);
    }
}
