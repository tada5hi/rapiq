/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '@rapiq/core';
import { serializeAsURI } from '../../utils';
import type { ISerializer } from './types';

export class RecordArraySerializer<
    ItemType = string,
> implements ISerializer<string | null> {
    protected prefix : string | undefined;

    public readonly value : Record<string, ItemType[]>;

    constructor(prefix?: string) {
        this.prefix = prefix;
        this.value = {};
    }

    add(key: string, value: ItemType) {
        if (!this.value[key]) {
            this.value[key] = [];
        }

        this.value[key].push(value);
    }

    serialize(): string | null {
        const keys = Object.keys(this.value);
        if (keys.length === 0) {
            return null;
        }

        if (
            keys.length === 1 &&
            keys[0] === DEFAULT_ID
        ) {
            return serializeAsURI(
                this.value[DEFAULT_ID],
                {
                    prefixParts: [
                        ...(this.prefix ? [this.prefix] : []),
                    ],
                },
            );
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
