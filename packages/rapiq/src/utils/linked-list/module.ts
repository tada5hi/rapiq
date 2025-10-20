/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { LinkedListNode } from './node';

export class LinkedList<T = any> {
    protected head : LinkedListNode<T> | null;

    constructor() {
        this.head = null;
    }

    addNode(node: LinkedListNode<T>) {
        if (!this.head) {
            this.head = node;
            return;
        }

        let currentNode : LinkedListNode<T> = this.head;
        while (currentNode.next) {
            currentNode = currentNode.next;
        }

        currentNode.next = node;
    }

    iterator() : Iterator<T, null> {
        let currentNode = this.head;

        return {
            next() {
                if (!currentNode) {
                    return {
                        value: null,
                        done: true,
                    };
                }

                const returnValue : IteratorYieldResult<T> = {
                    value: currentNode.value,
                    done: false,
                };

                currentNode = currentNode.next;
                return returnValue;
            },
        };
    }

    [Symbol.iterator]() {
        return this.iterator();
    }
}
