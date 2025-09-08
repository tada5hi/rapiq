/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition } from 'rapiq';
import {
    type FiltersContainerOptions, createSqlInterpreter, eq, pg,
} from '../../../src';

const spy = {
    on: jest.spyOn,
    restore: (..._args: any[]) => jest.clearAllMocks(),
};

const options: FiltersContainerOptions = {
    ...pg,
};

describe('auto join', () => {
    const interpret = createSqlInterpreter({ eq });
    const condition = new FieldCondition('eq', 'projects.user.name', 'test');

    it('calls `joinRelation` function passing relation name when using dot notation', () => {
        interpret(condition, options);
    });

    it('escapes relation name with `options.escapeField`', () => {
        spy.on(options, 'escapeField');
        const [sql] = interpret(condition, options);

        expect(sql).toEqual('"user"."name" = $1');
        expect(options.escapeField).toHaveBeenCalledWith('user');
        spy.restore(options, 'escapeField');
    });
});
