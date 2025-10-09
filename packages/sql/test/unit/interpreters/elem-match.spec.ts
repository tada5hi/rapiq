/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { CompoundCondition, FieldCondition } from 'rapiq';
import type { FiltersContainerOptions } from '../../../src';
import {
    FiltersAdapter,
    FiltersInterpreter,
    RelationsAdapter,
    and,
    elemMatch,
    eq,
    gt,
    lt,
    or,
    pg,
} from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('elemMatch', () => {
    const relationsAdapter = new RelationsAdapter();
    const adapter = new FiltersAdapter(
        relationsAdapter,
        options,
    );
    const interpreter = new FiltersInterpreter({
        interpreters: {
            elemMatch, eq, or, and, lt, gt,
        },
    });

    it('generates query from a field condition based on relation', () => {
        const condition = new FieldCondition(
            'elemMatch',
            'projects',
            new FieldCondition('eq', 'active', true),
        );

        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"projects"."active" = $1');
        expect(params).toStrictEqual([true]);
    });

    it('generates query from a compound condition based on relation', () => {
        const condition = new FieldCondition(
            'elemMatch',
            'projects',
            new CompoundCondition('and', [
                new FieldCondition('gt', 'count', 5),
                new FieldCondition('lt', 'count', 10),
            ]),
        );

        interpreter.interpret(condition, adapter, {});

        const [sql, params] = adapter.getQueryAndParameters();

        expect(sql).toEqual('("projects"."count" > $1 and "projects"."count" < $2)');
        expect(params).toStrictEqual([5, 10]);
    });
});
