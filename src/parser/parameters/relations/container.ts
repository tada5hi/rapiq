/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export class RelationsContainer {
    public readonly unknownAllowed : boolean;

    public readonly items : string[];

    constructor(input?: string[]) {
        this.unknownAllowed = typeof input === 'undefined';
        this.items = input || [];
    }

    /**
    add(key: string) {
        const keys = this.getParents(key);
        for (let i = 0; i < keys.length; i++) {
            const index = this.items.indexOf(keys[i]);
            if (index === -1) {
                this.items.push(keys[i]);
            }
        }
    }

    isAllowed(key: string) {
        const index = this.items.indexOf(key);
        if (index !== -1) {
            return true;
        }

        return this.unknownAllowed;
    }

    getParents(input: string) {
        const output : string[] = [data];

        const parts: string[] = input.split('.');

        while (parts.length > 0) {
            parts.pop();

            if (parts.length > 0) {
                const value = parts.join('.');
                if (output.indexOf(value) === -1) {
                    output.push(value);
                }
            }
        }

        return output.reverse();
    }
}
