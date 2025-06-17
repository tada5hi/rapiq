/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export class GraphNode<T = any> {
    id: string;

    path: string;

    parentId : string | undefined;

    level: number;

    data : T | undefined;

    children: GraphNode<T>[];

    // ----------------------------------------------

    constructor(
        path: string,
        data?: T,
    ) {
        this.path = path;
        this.data = data;
        this.children = [];

        const parts = path.split('.');
        if (parts.length > 1) {
            const parentId = parts.slice(parts.length - 2, parts.length - 1)
                .join('.');
            if (parentId) {
                this.parentId = parentId;
            }

            this.level = parts.length - 1;
            this.id = parts.pop() as string;
        } else {
            this.parentId = undefined;
            this.level = 0;
            this.id = path;
        }
    }

    // ----------------------------------------------

    add(path: string, data: T) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let current : GraphNode<T> = this;

        for (let i = 0; i < path.length; i++) {
            const key = path.slice(0, i + 1);

            let child = current.children.find((c) => c.path === key);

            if (!child) {
                if (i === (path.length - 1)) {
                    child = new GraphNode<T>(key, data);
                } else {
                    child = new GraphNode<T>(key);
                }

                current.children.push(child);
            }

            current = child;
        }
    }
}
