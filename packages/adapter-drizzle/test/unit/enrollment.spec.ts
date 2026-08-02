/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition } from '@rapiq/core';
import { FILTER_OPERATOR_SEMANTICS, isFilter, isFilters } from '@rapiq/core';
import {
    casePairs,
    collections,
    complementPairs,
    compounds,
    sameElement,
} from '../data/matrix';

/**
 * Operators the serializer refuses typed (see the
 * unsupported-operators specs); no engine parity row can exist for
 * them. A new semantics-table member must land in exactly one of the
 * two lists: an engine matrix row, or this set plus its typed spec.
 */
const UNSUPPORTED = new Set(['regex', 'mod', 'size']);

function collect(condition: ICondition, output: Set<string>) : void {
    if (isFilters(condition)) {
        condition.value.forEach((child) => collect(child as ICondition, output));
        return;
    }

    if (isFilter(condition)) {
        output.add(condition.operator);

        // the interior is a condition of its own
        if (condition.operator === 'elemMatch') {
            collect(condition.value as ICondition, output);
        }
    }
}

/**
 * The enrollment tripwire the typeorm parity suite established: a
 * new member of the core semantics table fails here until it is
 * enrolled in the engine parity matrix (or documented unsupported),
 * instead of shipping unmeasured.
 */
describe('operator enrollment', () => {
    it('should enroll every operator of the semantics table', () => {
        const covered = new Set<string>();

        [...complementPairs, ...casePairs].forEach(([, positive, negative]) => {
            collect(positive, covered);
            collect(negative, covered);
        });

        [...compounds, ...collections, ...sameElement].forEach(([, condition]) => {
            collect(condition, covered);
        });

        for (const operator of Object.keys(FILTER_OPERATOR_SEMANTICS)) {
            if (UNSUPPORTED.has(operator)) {
                continue;
            }

            expect(covered, `operator ${operator} has no parity case`)
                .toContain(operator);
        }
    });
});
