/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { CallLowering } from '../../call';

export interface IGroupVisitor<R> {
    visitGroup(expr: IGroup): R;
}

export interface IGroup {
    /** Output key: the row key and the grouped sort target. Equals `name`. */
    readonly key: string;

    /** Callee or bare column, as written on the wire. */
    readonly name: string;

    /** Wire arguments as written; [] for a bare column. */
    readonly params: readonly string[];

    /** undefined = unresolved (a client-built named call); adapters refuse it. */
    readonly lowering: CallLowering | undefined;

    accept<R>(visitor: IGroupVisitor<R>) : R;
}

export type GroupOptions = {
    name: string,
    params?: string[],
    lowering?: CallLowering,
};
