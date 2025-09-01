/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { GraphNode } from './node';

export function breadthFirstSearchReverse<T>(node: GraphNode<T>, fn: (node: GraphNode<T>) => void) {
    for (let i = 0; i < node.children.length; i++) {
        breadthFirstSearchReverse(node.children[i], fn);
    }

    fn(node);
}
