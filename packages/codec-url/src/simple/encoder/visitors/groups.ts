/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    IGroup,
    IGroupVisitor,
    IGroups,
    IGroupsVisitor,
} from '@rapiq/core';

import { URLParameter } from '../../../constants';
import { ArraySerializer } from '../serializer';
import { serializeCallTermStrict } from './calls';

export class GroupsVisitor implements IGroupsVisitor<ArraySerializer>,
IGroupVisitor<ArraySerializer> {
    protected serializer : ArraySerializer;

    constructor(serializer?: ArraySerializer) {
        this.serializer = serializer || new ArraySerializer(
            URLParameter.GROUPS,
        );
    }

    visitGroups(expr: IGroups): ArraySerializer {
        for (const item of expr.value) {
            item.accept(this);
        }

        return this.serializer;
    }

    visitGroup(expr: IGroup): ArraySerializer {
        this.serializer.add(serializeCallTermStrict(expr, 'groups:term'));

        return this.serializer;
    }
}
