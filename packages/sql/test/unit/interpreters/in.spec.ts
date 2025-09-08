/*
 * Copyright (c) 2025-2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CompoundCondition, FieldCondition } from 'rapiq';
import {
    type FiltersContainerOptions, and, createSqlInterpreter, eq, nin, pg, within,
} from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('in (within, nin)', () => {
    const interpret = createSqlInterpreter({
        within, nin, and, eq,
    });

    it('generates a separate placeholder for every element in the array', () => {
        const condition = new FieldCondition('within', 'age', [1, 2]);
        const [sql, params] = interpret(condition, options);

        expect(sql).toEqual(`${options.escapeField(condition.field)} in($1, $2)`);
        expect(params).toStrictEqual(condition.value);
    });

    it('correctly generates placeholders when combined with other operators', () => {
        const condition = new CompoundCondition('and', [
            new FieldCondition('eq', 'name', 'John'),
            new FieldCondition('within', 'age', [1, 2]),
        ]);
        const [sql, params] = interpret(condition, options);

        expect(sql).toEqual('("name" = $1 and "age" in($2, $3))');
        expect(params).toStrictEqual(['John', 1, 2]);
    });

    it('generates `not in` operator for "nin', () => {
        const condition = new FieldCondition('nin', 'age', [1, 2]);
        const [sql, params] = interpret(condition, options);

        expect(sql).toEqual(`${options.escapeField(condition.field)} not in($1, $2)`);
        expect(params).toStrictEqual(condition.value);
    });
});
