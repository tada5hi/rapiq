/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { BucketUnit } from '@rapiq/core';

/**
 * strftime-style patterns (mysql `date_format`, sqlite `strftime`) that
 * print the start of a unit as `YYYY-MM-DDTHH:MM:SS.000Z`: the literal
 * parts stand in for the truncated components, so formatting alone
 * truncates. Both engines read the stored wall clock, which is UTC by
 * the zone-less column rule (#939).
 */
export const BUCKET_FORMATS : Record<`${BucketUnit}`, string> = {
    hour: '%Y-%m-%dT%H:00:00.000Z',
    day: '%Y-%m-%dT00:00:00.000Z',
    month: '%Y-%m-01T00:00:00.000Z',
};
