/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, InterpretationContext } from '@ucast/core';
import type { FiltersParseOutput } from 'rapiq';
import { allInterpreters } from '../operators';
import type { IFiltersAdapter } from '../adapter';
import type { InterpreterInterpretOptions } from './types';

export type FilterInterpreterInterpretOptions = InterpretationContext<
FiltersInterpreter['interpret']
> & InterpreterInterpretOptions;

export type FilterInterpreterWithContext<
    C extends Condition = Condition,
> = (
    condition: C,
    adapter: IFiltersAdapter,
    context: InterpretationContext<FilterInterpreterWithContext<C>> & {
        rootAlias?: string
    },
) => IFiltersAdapter;

export type FiltersInterpreterOptions = {
    interpreters?: Record<string, FilterInterpreterWithContext<any>>
};

export class FiltersInterpreter {
    protected interpreters : Record<string, FilterInterpreterWithContext<any>>;

    constructor(options: FiltersInterpreterOptions = {}) {
        this.interpreters = options.interpreters || allInterpreters as Record<string, any>;
    }

    interpret(
        input: FiltersParseOutput,
        adapter: IFiltersAdapter,
        options: Omit<FilterInterpreterInterpretOptions, 'interpret'>,
    ) {
        adapter.clear();

        const output = this.interpretInternal(
            input,
            adapter,
            options,
        );

        const execute = options.execute ?? true;
        if (execute) {
            output.execute();
        }

        return output;
    }

    protected interpretInternal(
        input: FiltersParseOutput,
        adapter: IFiltersAdapter,
        options: Omit<FilterInterpreterInterpretOptions, 'interpret'>,
    ) {
        const name = this.getName(input);
        const interpreter = this.get(name);

        const optionsNormalized : FilterInterpreterInterpretOptions = {
            ...options,
            interpret: (
                childCondition,
                childContainer,
            ) => this.interpretInternal(
                childCondition,
                childContainer,
                optionsNormalized,
            ),
        };

        interpreter(input, adapter, optionsNormalized);

        return adapter;
    }

    protected getName(condition: Condition) {
        return `${condition.operator}`;
    }

    protected get(name: string) {
        const interpreter = this.interpreters[name];
        if (!interpreter) {
            throw new Error(`Unable to interpret "${name}" condition.`);
        }
        return interpreter;
    }
}
