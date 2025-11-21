/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IAdapter } from '../types';

export interface IFiltersAdapter<
QUERY extends Record<string, any> = Record<string, any>,
> extends IAdapter<QUERY> {
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

    merge<
        T extends IFiltersAdapter<QUERY>,
    >(
        query: T,
        operator?: 'and' | 'or',
        isInverted? : boolean,
    ) : this;

    child() : this;

    getQueryAndParameters(): [string, unknown[]];
}
