/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export class LinkedListNode<T = any> {
    value : T;

    next : null | LinkedListNode<T>;

    constructor(value: T) {
        this.value = value;
        this.next = null;
    }
}
