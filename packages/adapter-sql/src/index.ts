/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export * from './adapter';
export * from './dialect';
export {
    LIKE_ESCAPE_CHARACTER,
    ParamPlaceholderIndexer,
    buildRelationAlias,
    escapeLikePattern,
    parseField,
    splitFirst,
    splitLast,
} from './helpers';
export type { IsRelationPathFn, RelationAliasFn } from './helpers';
export * from './visitor';
