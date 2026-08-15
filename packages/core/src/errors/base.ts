/*
 * Copyright (c) 2023.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { BaseError as EbecBaseError, markInstanceof } from '@ebec/core';
import type { Issue } from 'blemish';
import { BASE_ERROR_MARKER } from './check';
import { ErrorCode } from './code';
import type { BaseErrorOptions, IBaseError, SerializedError } from './types';

function serializeIssue(input: Issue) : Issue {
    const output = { ...input };
    if (output.type === 'group') {
        output.issues = output.issues.map(serializeIssue);
    } else {
        delete output.expected;
        delete output.received;
    }

    return output;
}

/**
 * The root of rapiq's error hierarchy.
 *
 * Extends `@ebec/core`'s, the house error substrate, for everything an error
 * base does the same way everywhere: the class name, the stack capture, the
 * `code`, the `cause` passthrough and the brand chain. rapiq adds the one
 * thing that is its own — the trace — and narrows `code` to its vocabulary.
 *
 * What it does NOT take is the group half. `errors: Error[]` stays unset,
 * because everything rapiq aggregates is a client-input rejection, which is
 * data and lives in {@link issues}; minting an `Error` per rejected key is the
 * carrier this design exists to avoid.
 */
export class BaseError extends EbecBaseError implements IBaseError {
    /**
     * Every rejection the operation recorded, in the order it hit them.
     * Empty unless the operation collected a trace.
     *
     * An ordinary enumerable property, so it shows up when the error is
     * inspected or spread. The cost, chosen deliberately: deep equality reads
     * enumerable properties, so two failures of the same kind compare equal
     * only when their traces match — `toThrow(SomeError.keyNotPermitted('x'))`
     * asserts the trace too. Assert the class or the code, or reach into
     * `issues`, rather than comparing whole errors.
     */
    public readonly issues : readonly Issue[];

    constructor(input: BaseErrorOptions | string) {
        super(typeof input === 'string' ?
            input :
            { ...input, code: input.code || ErrorCode.NONE });

        this.issues = typeof input === 'string' ? [] : input.issues ?? [];

        markInstanceof(this, BASE_ERROR_MARKER);
    }

    /**
     * The wire form: the base's, plus the one thing rapiq adds.
     *
     * An error whose trace does not survive the boundary has nothing to say on
     * the far side, and the `@instanceof` chain the base emits is what lets
     * `isParseError` answer for the plain object that arrives.
     */
    override toJSON() : SerializedError {
        return {
            ...super.toJSON(),
            issues: this.issues.map(serializeIssue),
        } as SerializedError;
    }
}
