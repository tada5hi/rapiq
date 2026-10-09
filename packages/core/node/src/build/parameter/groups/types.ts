/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IGroup, IGroups } from '../../../parameter';
import type { ObjectLiteral, SimpleKeys } from '../../../types';
import type { CallBuildInput } from '../call';

export type GroupsBuildInput<
    RECORD extends ObjectLiteral = ObjectLiteral,
> = (SimpleKeys<RECORD> | CallBuildInput | IGroup)[] | IGroups;
