/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { ITSELF, isCondition } from '../../../parameter';
import { isObject } from '../../../utils';
import { isParameterNode } from '../../utils';

/**
 * Whether a field value opens a nested record to traverse into rather than
 * describing the field itself. Everything else is a leaf: a scalar, `null`,
 * a bare array (`in` sugar), a `RegExp`, a `Date`, or an operator object.
 *
 * Internal, and single-sourced deliberately. `buildFieldConditions` lowers a
 * value with this rule and `mergeFiltersInput` canonicalizes key paths with
 * it, so a value shape that moved between leaf and branch without both
 * agreeing would silently yield a different set of paths than it yields
 * conditions. It lives here rather than in either consumer so neither owns
 * it, and it is kept out of the barrel because it is not public API.
 */
export function isNestedRecordValue(field: string, value: unknown) : boolean {
    return (
        isObject(value) &&
        !Array.isArray(value) &&
        !(value instanceof RegExp) &&
        !(value instanceof Date) &&
        !isCondition(value) &&
        !isParameterNode(value) &&
        !Object.keys(value).some((key) => key.substring(0, 1) === '$') &&
        field !== ITSELF
    );
}
