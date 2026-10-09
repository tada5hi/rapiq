/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { DEFAULT_ID } from '@rapiq/core';
import { URL_FIELDS_ROOT } from '../../../constants';
import { serializeAsURI } from '../../utils';
import type { ISerializer } from './types';

export class RecordArraySerializer<
    ItemType = string,
> implements ISerializer<string | null> {
    protected prefix : string | undefined;

    protected value : Record<string, ItemType[]>;

    constructor(prefix?: string) {
        this.prefix = prefix;
        this.value = {};
    }

    reset() {
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

        // the internal DEFAULT_ID sentinel never leaks onto the wire:
        // the root group is spelled with the public token instead.
        const { [DEFAULT_ID]: root, ...groups } = this.value;
        const output : Record<string, ItemType[]> = typeof root === 'undefined' ?
            groups :
            { [URL_FIELDS_ROOT]: root, ...groups };

        return serializeAsURI(
            output,
            {
                prefixParts: [
                    ...(this.prefix ? [this.prefix] : []),
                ],
            },
        );
    }
}
