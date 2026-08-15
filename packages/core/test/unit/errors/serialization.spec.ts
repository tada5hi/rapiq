/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BASE_ERROR_INSTANCE, INSTANCEOF_PROPERTY } from '@ebec/core';
import { defineIssueGroup } from 'blemish';
import {
    BASE_ERROR_MARKER,
    BaseError,
    ErrorCode,
    ErrorMessage,
    FiltersParseError,
    PARSE_ERROR_MARKER,
    Parameter,
    ParseError,
    buildIssue,
    isBaseError,
    isParseError,
} from '../../../src';

const issue = () => buildIssue({
    code: ErrorCode.KEY_NOT_ALLOWED,
    parameter: Parameter.FILTERS,
    path: ['items', 'secret'],
    message: ErrorMessage.keyNotPermitted('secret'),
});

/**
 * The wire shape is a contract, not an accident: it is what a receiver parses,
 * and it moves under a caret range on `@ebec/core` unless something pins it.
 */
describe('src/errors/base.ts (serialization)', () => {
    it('should emit the trace, the code and the brand chain', () => {
        const error = ParseError.inputRejected([issue()]);

        expect(JSON.parse(JSON.stringify(error))).toEqual({
            name: 'ParseError',
            message: ErrorMessage.inputRejected(1),
            code: ErrorCode.INPUT_REJECTED,
            issues: [{
                type: 'item',
                code: ErrorCode.KEY_NOT_ALLOWED,
                path: ['items', 'secret'],
                message: ErrorMessage.keyNotPermitted('secret'),
                meta: { parameter: Parameter.FILTERS },
            }],
            // the base substrate marks itself first, so ebec's own guard
            // recognizes a rapiq error through the chain rather than by
            // duck-typing it
            [INSTANCEOF_PROPERTY]: [
                BASE_ERROR_INSTANCE.description,
                BASE_ERROR_MARKER.description,
                PARSE_ERROR_MARKER.description,
            ],
        });
    });

    it('should name the class that was raised', () => {
        const error = FiltersParseError.inputRejected([issue()]);

        expect(JSON.parse(JSON.stringify(error)).name).toBe('FiltersParseError');
    });

    it('should redact received and safely clone open issue values', () => {
        const received : Record<string, unknown> = { secret: 'token', size: 1n };
        received.self = received;

        const meta : Record<string, unknown> = { count: 2n };
        meta.self = meta;

        const leaf = buildIssue({
            code: ErrorCode.KEY_VALUE_INVALID,
            parameter: Parameter.FILTERS,
            path: ['items', 'id'],
            message: ErrorMessage.keyValueInvalid('id'),
            received,
        });
        const group = defineIssueGroup({
            path: ['items'],
            message: 'Nested validation failed.',
            meta,
            issues: [leaf],
        });
        const error = ParseError.inputRejected([group]);

        const serialized = JSON.parse(JSON.stringify(error));
        expect(serialized.issues[0].issues[0]).not.toHaveProperty('received');
        expect(serialized.issues[0].meta).toEqual({
            count: '2',
            self: '[Circular]',
        });
        expect(error.issues[0]).toBe(group);
        expect(leaf.received).toBe(received);
    });

    it('should normalize unsupported issue values without calling user serializers', () => {
        let toJSONCalls = 0;
        const shared = { value: 'shared' };
        const custom = {
            value: 'safe',
            toJSON() {
                toJSONCalls++;
                return 'unsafe';
            },
        };
        const item = issue();
        item.meta = {
            custom,
            first: shared,
            second: shared,
            omitted: undefined,
            values: [undefined, Symbol('secret'), () => 'secret'],
        };

        const serialized = JSON.parse(JSON.stringify(ParseError.inputRejected([item])));

        expect(serialized.issues[0].meta).toEqual({
            custom: { value: 'safe' },
            first: { value: 'shared' },
            second: '[Circular]',
            values: [null, null, null],
        });
        expect(toJSONCalls).toBe(0);
    });

    it('should redact received without evaluating it', () => {
        const item = issue();
        Object.defineProperty(item, 'received', {
            enumerable: true,
            get() {
                throw new Error('received getter evaluated');
            },
        });

        const serialized = JSON.parse(JSON.stringify(ParseError.inputRejected([item])));

        expect(serialized.issues[0]).not.toHaveProperty('received');
    });

    it('should preserve an own __proto__ metadata property without changing the prototype', () => {
        const meta : Record<string, unknown> = {};
        Object.defineProperty(meta, '__proto__', {
            enumerable: true,
            value: { safe: true },
        });
        const item = issue();
        item.meta = meta;
        const error = ParseError.inputRejected([item]);

        const serializedMeta = error.toJSON().issues[0]?.meta;
        expect(Object.hasOwn(serializedMeta ?? {}, '__proto__')).toBeTruthy();
        expect(Object.getPrototypeOf(serializedMeta)).toBe(Object.prototype);

        const roundTrippedMeta = JSON.parse(JSON.stringify(error)).issues[0].meta;
        expect(Object.hasOwn(roundTrippedMeta, '__proto__')).toBeTruthy();
        expect(Reflect.get(roundTrippedMeta, '__proto__')).toEqual({ safe: true });
    });

    it('should carry a cause only when there is one', () => {
        expect(JSON.parse(JSON.stringify(new BaseError('failed')))).not.toHaveProperty('cause');

        const error = new BaseError({ message: 'failed', cause: new Error('origin') });
        expect(JSON.parse(JSON.stringify(error)).cause).toMatchObject({ message: 'origin' });
    });

    it('should stay recognizable after a round trip', () => {
        const revived = JSON.parse(JSON.stringify(FiltersParseError.inputRejected([issue()])));

        // the value is a plain object now, not an Error, and `instanceof`
        // could never answer this — the serialized chain is what does
        expect(revived).not.toBeInstanceOf(Error);
        expect(isBaseError(revived)).toBeTruthy();
        expect(isParseError(revived)).toBeTruthy();
    });

    it('should put the trace in the enumerable shape', () => {
        const options = { message: 'failed', code: ErrorCode.INPUT_REJECTED };

        // deep equality reads enumerable own properties, so two failures of
        // the same kind compare equal only when their traces match. Assert the
        // class, the code or the trace — not whole errors.
        expect(new ParseError({ ...options, issues: [issue()] }))
            .not.toEqual(new ParseError({ ...options, issues: [] }));

        // pinned in ONE place: the rest of the members come from the base
        // substrate, and a change there should fail here rather than in three
        // unrelated specs
        expect(Object.keys(new ParseError(options))).toEqual(['code', 'cause', 'errors', 'issues']);
    });
});
