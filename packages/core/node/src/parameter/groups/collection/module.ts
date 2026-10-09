/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import { MergeError } from '../../../errors';
import { isCallEqual } from '../../call';
import type { IGroup } from '../record';
import type { IGroups, IGroupsVisitor } from './types';

export class Groups implements IGroups {
    readonly value: IGroup[];

    constructor(value: IGroup[] = []) {
        this.value = value;
    }

    accept<R>(visitor: IGroupsVisitor<R>) : R {
        return visitor.visitGroups(this);
    }

    /**
     * An empty side yields the other; the same groups in the same order
     * yield the receiver; anything else throws a typed MergeError. A
     * union or a left win would fabricate or discard a grain.
     */
    merge(other: IGroups) : IGroups {
        if (this.value.length === 0) {
            return other;
        }

        if (other.value.length === 0) {
            return this;
        }

        if (
            this.value.length === other.value.length &&
            this.value.every((item, index) => isCallEqual(item, other.value[index]!))
        ) {
            return this;
        }

        throw MergeError.callsConflict(Parameter.GROUPS);
    }
}
