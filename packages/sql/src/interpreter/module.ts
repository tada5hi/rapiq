/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { Condition } from 'rapiq';
import type { FiltersContainerOptions } from '../container';
import { FiltersContainer, RelationsContainer } from '../container';
import type { FilterInterpreterWithContext } from '../interpeter';
import { FiltersInterpreter } from '../interpeter';

export function createSqlInterpreter(
    operators: Record<string, FilterInterpreterWithContext<any>>,
) {
    const interpreter = new FiltersInterpreter(operators);

    return (
        condition: Condition,
        options: FiltersContainerOptions,
        targetQuery?: Record<string, any>,
    ) => {
        const relationsContainer = new RelationsContainer({
            join: () => true
        });

        relationsContainer.withQuery(targetQuery);

        const container = new FiltersContainer(relationsContainer, options);
        container.withQuery(targetQuery);

        return interpreter.interpret(
            condition,
            container,
            {},
        ).getQueryAndParameters();
    };
}
