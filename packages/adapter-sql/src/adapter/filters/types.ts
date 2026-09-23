/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { TemporalKind } from '../../dialect';
import type { ISubAdapter } from '../types';

export interface IFiltersAdapter extends ISubAdapter {
    conditions: string[];

    params : unknown[];

    where(field: string, operator: string, value?: unknown) : this;
    whereRaw(sql: string, ...values: unknown[]) : this;

    buildField(input: string) : string;

    buildParamPlaceholder() : string;
    buildParamsPlaceholders(input: unknown[]) : string[];

    getFieldPrefix(): string;
    setFieldPrefix(prefix: string) : void;

    regexp(field: string, placeholder: string, ignoreCase: boolean) : string;

    isRegexpSupported() : boolean;

    mod(field: string, divisorPlaceholder: string, remainderPlaceholder: string) : string;

    caseFold(input: string) : string;

    /**
     * Optional so an adapter predating the LIKE rendering still
     * satisfies the interface; the visitor falls back to `caseFold`.
     */
    caseFoldLike?(input: string) : string;

    isLikeBracketWildcard?() : boolean;

    castText?(input: string, field?: string) : string;

    isCaseFoldable(field: string) : boolean;

    bindValue(field: string, value: unknown) : unknown;

    /**
     * How a column stores a temporal value, read by the `bucket` group
     * function; `undefined` for a column that is not temporal. Optional
     * so an implementation predating grouped queries keeps compiling.
     */
    temporalKind?(field: string) : TemporalKind | undefined;

    /**
     * Whether a column holds numbers, read by the `sum` aggregate
     * function. Optional so an implementation predating grouped
     * queries keeps compiling.
     */
    isNumeric?(field: string) : boolean;

    merge<
        T extends IFiltersAdapter,
    >(
        query: T,
        operator?: 'and' | 'or',
        isInverted? : boolean,
    ) : this;

    child() : this;

    getQueryAndParameters(): [string, unknown[]];
}
