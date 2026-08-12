/*
 * Copyright (c) 2026.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { BuildError, ErrorCode, defineQuery } from '../../../src';
import type { User } from '../../data';

describe('src/build/module.ts', () => {
    it('should accept the canonical sorts key', () => {
        const query = defineQuery<User>({ sorts: '-id' });

        expect(query.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual([['id', 'DESC']]);
    });

    it('should accept the deprecated sort key', () => {
        const query = defineQuery<User>({ sort: '-id' });

        expect(query.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual([['id', 'DESC']]);
    });

    it('should build an identical query from either spelling', () => {
        const canonical = defineQuery<User>({ sorts: ['id', '-name'] });
        const legacy = defineQuery<User>({ sort: ['id', '-name'] });

        expect(canonical.sorts.value.map((el) => [el.name, el.operator]))
            .toEqual(legacy.sorts.value.map((el) => [el.name, el.operator]));
    });

    it('should reject both spellings at once', () => {
        expect(() => defineQuery<User>({ sorts: '-id', sort: 'name' } as any))
            .toThrow(BuildError);
    });

    it('should carry the ambiguous-key error code', () => {
        try {
            defineQuery<User>({ sorts: '-id', sort: 'name' } as any);
            expect.unreachable('defineQuery did not throw');
        } catch (e) {
            expect((e as BuildError).code).toBe(ErrorCode.KEY_AMBIGUOUS);
        }
    });

    it('should reject both spellings even when they agree', () => {
        expect(() => defineQuery<User>({ sorts: '-id', sort: '-id' } as any))
            .toThrow(BuildError);
    });
});
