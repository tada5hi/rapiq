/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    AdapterError,
    BuildError,
    ErrorCode,
    ErrorMessage,
    SchemaError,
} from '../../../src';

describe('src/errors/*.ts', () => {
    it('should build the call failure messages', () => {
        expect(ErrorMessage.callArgumentsInvalid('bucket')).toBe('The arguments of bucket are invalid.');
        expect(ErrorMessage.outputKeyDuplicate('count')).toBe('The output key count is requested more than once.');
        expect(ErrorMessage.groupColumnDuplicate('createdAt')).toBe('The column createdAt is grouped more than once.');
        expect(ErrorMessage.functionInvalid('period', 'the slot unit is missing'))
            .toBe('The function period is invalid: the slot unit is missing.');
    });

    it('should raise an invalid function declaration as a schema error', () => {
        const error = SchemaError.functionInvalid('period', 'the slot unit is missing');

        expect(error).toBeInstanceOf(SchemaError);
        expect(error.code).toBe(ErrorCode.KEY_INVALID);
        expect(error.message).toBe(ErrorMessage.functionInvalid('period', 'the slot unit is missing'));
    });

    it('should raise a duplicate output key as a build error', () => {
        const error = BuildError.outputKeyDuplicate('count');

        expect(error).toBeInstanceOf(BuildError);
        expect(error.code).toBe(ErrorCode.KEY_AMBIGUOUS);
        expect(error.message).toBe(ErrorMessage.outputKeyDuplicate('count'));
    });

    it('should raise a column grouped twice as a build and an adapter error', () => {
        const build = BuildError.groupColumnDuplicate('createdAt');
        expect(build).toBeInstanceOf(BuildError);
        expect(build.code).toBe(ErrorCode.KEY_AMBIGUOUS);
        expect(build.message).toBe(ErrorMessage.groupColumnDuplicate('createdAt'));

        const adapter = AdapterError.groupColumnDuplicate('createdAt');
        expect(adapter).toBeInstanceOf(AdapterError);
        expect(adapter.code).toBe(ErrorCode.KEY_AMBIGUOUS);
        expect(adapter.message).toBe(ErrorMessage.groupColumnDuplicate('createdAt'));
    });
});
