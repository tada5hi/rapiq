/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition } from 'rapiq';
import {
    type FiltersContainerOptions, createSqlInterpreter, exists, pg,
} from '../../../src';

const options: FiltersContainerOptions = {
    ...pg,
};

describe('exists', () => {
    const interpret = createSqlInterpreter({ exists });

    it('generates query with `is not null` operator when value equals `true`', () => {
        const condition = new FieldCondition('exists', 'address', true);
        const [sql, params] = interpret(condition, options);

        expect(sql).toEqual(`${options.escapeField(condition.field)} is not null`);
        expect(params).toEqual([]);
    });

    it('generates query with `is null` operator when value equals `false`', () => {
        const condition = new FieldCondition('exists', 'address', false);
        const [sql, params] = interpret(condition, options);

        expect(sql).toEqual(`${options.escapeField(condition.field)} is null`);
        expect(params).toEqual([]);
    });
});
