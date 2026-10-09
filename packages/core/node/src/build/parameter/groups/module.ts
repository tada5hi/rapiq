/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Parameter } from '../../../constants';
import { BuildError } from '../../../errors';
import type { IGroup, IGroups } from '../../../parameter';
import {
    Group,
    Groups,
    findGroupColumnDuplicate,
    isGroup,
    isGroups,
} from '../../../parameter';
import type { ObjectLiteral } from '../../../types';
import { isParameterNode } from '../../utils';
import { assertCallKeysUnique, buildCallOptions } from '../call/module';
import type { GroupsBuildInput } from './types';

/**
 * The generic-less overload comes first, as for the other define*
 * factories, so a bare string is not inferred as the record type.
 */
export function defineGroups(input: GroupsBuildInput<ObjectLiteral>) : IGroups;
export function defineGroups<
    RECORD extends ObjectLiteral,
>(input: GroupsBuildInput<RECORD>) : IGroups;
export function defineGroups(input: GroupsBuildInput<ObjectLiteral>) : IGroups {
    if (isGroups(input)) {
        return input;
    }

    if (!Array.isArray(input)) {
        throw BuildError.inputInvalid();
    }

    const output : IGroup[] = input.map((element) => {
        if (isGroup(element)) {
            return element;
        }

        // a node of another parameter (a Sort, an Aggregate) is no group.
        if (isParameterNode(element)) {
            throw BuildError.inputInvalid();
        }

        return new Group(buildCallOptions(Parameter.GROUPS, element));
    });

    const column = findGroupColumnDuplicate(output);
    if (typeof column !== 'undefined') {
        throw BuildError.groupColumnDuplicate(column);
    }

    assertCallKeysUnique(output.map((item) => item.key));

    return new Groups(output);
}
