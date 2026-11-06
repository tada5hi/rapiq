export type Field = {
    prefix?: string,
    relation?: string,
    name: string
};

/**
 * Whether a dotted field prefix refers to a chain of relations.
 */
export type IsRelationPathFn = (path: string) => boolean;



/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type RelationAliasFn = (path: string) => string;
