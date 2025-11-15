/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { serializeAsURI } from '../../utils';
import type { ISerializer } from './types';

export class ArraySerializer<
    ItemType = any,
> implements ISerializer<string | null> {
    protected prefix : string | undefined;

    public readonly value : ItemType[];

    constructor(prefix?: string) {
        this.prefix = prefix;
        this.value = [];
    }

    add(value: ItemType) {
        this.value.push(value);
    }

    serialize(): string | null {
        if (this.value.length === 0) {
            return null;
        }

        return serializeAsURI(
            this.value,
            {
                prefixParts: [
                    ...(this.prefix ? [this.prefix] : []),
                ],
            },
        );
    }
}
