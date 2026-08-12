/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode } from '../../../src';

describe('src/errors/adapter.ts', () => {
    describe('featureUnsupported', () => {
        it('carries the tag as a structured feature property (A6, plan 032)', () => {
            const error = AdapterError.featureUnsupported('filters:regex');

            expect(error.feature).toBe('filters:regex');
            expect(error.code).toBe(ErrorCode.FEATURE_UNSUPPORTED);
        });

        it('keeps the message text byte-identical', () => {
            const error = AdapterError.featureUnsupported('regexp');

            expect(error.message).toBe('The feature regexp is not supported by the dialect.');
        });
    });

    describe('operatorUnsupported / conditionDetached', () => {
        it('leave feature undefined — the tag is featureUnsupported-specific', () => {
            expect(AdapterError.operatorUnsupported('mod').feature).toBeUndefined();
            expect(AdapterError.conditionDetached('mod').feature).toBeUndefined();
        });
    });
});
