/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * The accepted wire grammar: an ISO-8601 calendar date, optionally
 * followed by a clock (separated by `T` or a space, the form a URL
 * carries more comfortably) and an optional `Z`/`±HH:MM` offset.
 *
 * Matching explicitly rather than handing the string to `new Date()`:
 * that parser accepts implementation-defined forms (`'August 23, 2026'`
 * parses, `'2026'` silently means January 1st) and rolls a day the
 * calendar does not have over into the next month, so a client typo
 * would quietly select a different day instead of being refused.
 */
const ISO_8601 = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3})\d*)?(Z|z|[+-]\d{2}:?\d{2})?)?$/;

function parseISO(input: string) : Date | undefined {
    const match = ISO_8601.exec(input);
    if (!match) {
        return undefined;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hours = match[4] ? Number(match[4]) : 0;
    const minutes = match[5] ? Number(match[5]) : 0;
    const seconds = match[6] ? Number(match[6]) : 0;
    const milliseconds = match[7] ? Number(match[7].padEnd(3, '0')) : 0;

    if (hours > 23 || minutes > 59 || seconds > 59) {
        return undefined;
    }

    const date = new Date(Date.UTC(
        year,
        month - 1,
        day,
        hours,
        minutes,
        seconds,
        milliseconds,
    ));

    // `Date.UTC` normalizes an impossible calendar date (February 30th
    // becomes March 2nd) instead of refusing it, so compare the parts
    // back. The offset is applied afterwards, keeping this check on
    // the calendar the client actually wrote.
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    ) {
        return undefined;
    }

    const offset = match[8];
    if (!offset || offset === 'Z' || offset === 'z') {
        // A zone-less value means UTC, the same rule this library
        // reads a zone-less column with. `new Date()` would read it in
        // the HOST's zone, which makes one query select different rows
        // on different machines.
        return date;
    }

    const sign = offset.startsWith('-') ? 1 : -1;
    const normalized = offset.slice(1).replace(':', '');
    const offsetHours = Number(normalized.slice(0, 2));
    const offsetMinutes = Number(normalized.slice(2));

    if (offsetHours > 23 || offsetMinutes > 59) {
        return undefined;
    }

    return new Date(date.getTime() + (sign * ((offsetHours * 60) + offsetMinutes) * 60_000));
}

/**
 * Coerce a filter operand into the instant it denotes, or `undefined`
 * if it denotes none.
 *
 * The wire is untyped: a date crosses it as a string, so every consumer
 * that knows a field is temporal has to turn that string back into an
 * instant before handing it to its backend. Coercing centrally (in the
 * condition lowering, say) is not an option: a varchar column may hold
 * ISO text, and comparing it as an instant would break it.
 *
 * Accepted: an ISO-8601 date or date-time string (read as UTC unless
 * it carries an offset), an epoch timestamp in milliseconds, and a
 * `Date`.
 */
export function toDate(input: unknown) : Date | undefined {
    if (input instanceof Date) {
        return Number.isNaN(input.getTime()) ? undefined : input;
    }

    if (typeof input === 'string') {
        return parseISO(input);
    }

    if (typeof input === 'number' && Number.isFinite(input)) {
        const date = new Date(input);

        return Number.isNaN(date.getTime()) ? undefined : date;
    }

    return undefined;
}
