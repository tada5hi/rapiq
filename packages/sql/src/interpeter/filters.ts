/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition, InterpretationContext } from '@ucast/core';
import type { FiltersParseOutput } from 'rapiq';
import { allInterpreters } from '../operators';
import type { FiltersContainer } from '../container';

export type FilterInterpreterOptions = InterpretationContext<
FiltersInterpreter['interpret']
> & {
    rootAlias?: string
};

export type FilterInterpreterWithContext<
    C extends Condition = Condition,
> = (
    condition: C,
    query: FiltersContainer,
    context: InterpretationContext<FilterInterpreterWithContext<C>> & {
        rootAlias?: string
    },
) => FiltersContainer;

export class FiltersInterpreter {
    protected interpreters : Record<string, FilterInterpreterWithContext>;

    constructor(interpreters: Record<string, FilterInterpreterWithContext> = {}) {
        this.interpreters = interpreters || allInterpreters as Record<string, any>;
    }

    interpret(
        input: FiltersParseOutput,
        container: FiltersContainer,
        options: Omit<FilterInterpreterOptions, 'interpret'>,
    ) {
        const output = this.interpretInternal(
            input,
            container,
            options,
        );
        output.apply();

        return output;
    }

    protected interpretInternal(
        input: FiltersParseOutput,
        container: FiltersContainer,
        options: Omit<FilterInterpreterOptions, 'interpret'>,
    ) {
        const name = this.getName(input);
        const interpreter = this.get(name);

        const optionsNormalized : FilterInterpreterOptions = {
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

        interpreter(input, container, optionsNormalized);

        return container;
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
