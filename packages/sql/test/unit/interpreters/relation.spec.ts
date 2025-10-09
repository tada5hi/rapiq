/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { FieldCondition } from 'rapiq';
import {
    FiltersAdapter, type FiltersContainerOptions, RelationsAdapter, eq, pg,
} from '../../../src';
import { FiltersInterpreter } from '../../../src/interpreter';

const spy = {
    on: jest.spyOn,
    restore: (..._args: any[]) => jest.clearAllMocks(),
};

const options: FiltersContainerOptions = {
    ...pg,
};

describe('auto join', () => {
    const relationsAdapter = new RelationsAdapter();
    const adapter = new FiltersAdapter(
        relationsAdapter,
        options,
    );
    const interpreter = new FiltersInterpreter({
        interpreters: { eq },
    });
    const condition = new FieldCondition('eq', 'projects.name', 'test');

    beforeEach(() => {
        spy.on(options, 'escapeField');
    });

    afterEach(() => {
        spy.restore(options, 'escapeField');
    });

    it('escapes relation name with `options.escapeField`', () => {
        interpreter.interpret(condition, adapter, {});
        const [sql] = adapter.getQueryAndParameters();

        expect(sql).toEqual('"projects"."name" = $1');
        expect(options.escapeField).toHaveBeenCalledWith('projects');
    });
});
