/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { serializeAsURI } from '../../utils';
import type { ISerializer } from './types';

export class RecordSerializer<
    ItemType = any,
> implements ISerializer<string | null> {
    protected prefix : string | undefined;

    public readonly value : Record<string, ItemType>;

    constructor(prefix?: string) {
        this.prefix = prefix;
        this.value = {};
    }

    set(key: string, value: ItemType) {
        this.value[key] = value;
    }

    serialize(): string | null {
        const keys = Object.keys(this.value);
        if (keys.length === 0) {
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
