/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { isObject } from '../utils';

type ParameterNode = { accept: (visitor: any) => any };

/**
 * Every AST parameter node (Fields, Filters, Filter, Pagination, ...)
 * carries an accept method for visitor dispatch; plain build input never
 * does. This separates already-built fragments from raw input.
 */
export function isParameterNode<T extends ParameterNode = ParameterNode>(
    input: unknown,
) : input is T {
    return isObject(input) && typeof input.accept === 'function';
}
