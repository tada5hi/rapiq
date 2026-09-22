/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Coerce a filter operand into the instant it denotes, or `undefined`
 * if it denotes none.
 *
 * The wire is untyped: a date crosses it as a string, so every consumer
 * that knows a field is temporal has to turn that string back into an
 * instant before handing it to its backend. Coercing centrally (in the
 * condition lowering, say) is not an option — a varchar column may hold
 * ISO text, and comparing it as an instant would break it.
 *
 * Strings and numbers are read by the `Date` constructor: an ISO-8601
 * string, or an epoch timestamp in milliseconds.
 */
export function toDate(input: unknown) : Date | undefined {
    let output : Date;

    if (input instanceof Date) {
        output = input;
    } else if (typeof input === 'string' || typeof input === 'number') {
        output = new Date(input);
    } else {
        return undefined;
    }

    if (Number.isNaN(output.getTime())) {
        return undefined;
    }

    return output;
}
