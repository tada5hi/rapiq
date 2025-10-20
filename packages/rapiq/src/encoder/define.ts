/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { Query } from '../parameter';
import type { ObjectLiteral } from '../types';
import type { BuildInput } from './types';
import { Builder } from './module';

export async function builder<T extends ObjectLiteral = ObjectLiteral>(
    input?: BuildInput<T>,
) : Promise<Query> {
    const builder = new Builder<T>();
    if (input) {
        await builder.addRaw(input);
    }

    return {
        fields: builder.fields,
    };
}
