export declare class GraphNode<T = any> {
    id: string;
    path: string;
    parentId: string | undefined;
    level: number;
    data: T | undefined;
    children: GraphNode<T>[];
    constructor(path: string, data?: T);
    add(path: string, data: T): void;
}
//# sourceMappingURL=node.d.ts.map