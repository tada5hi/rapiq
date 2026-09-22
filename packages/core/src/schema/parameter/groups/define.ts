/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ObjectLiteral } from '../../../types';
import { GroupsSchema } from './schema';
import type { GroupsOptions } from './types';

export function defineGroupsSchema<T extends ObjectLiteral = ObjectLiteral>(
    options: GroupsOptions<T> = {},
) : GroupsSchema<T> {
    return new GroupsSchema(options);
}
