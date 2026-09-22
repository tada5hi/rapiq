/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    BuildError,
    ErrorCode,
    ErrorMessage,
    SchemaError,
} from '../../../src';

describe('src/errors/*.ts', () => {
    it('should build the call failure messages', () => {
        expect(ErrorMessage.callArgumentsInvalid('bucket')).toBe('The arguments of bucket are invalid.');
        expect(ErrorMessage.outputKeyDuplicate('count')).toBe('The output key count is requested more than once.');
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
});
