/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { SimpleSortsParser } from '@rapiq/parser-simple';

export class MongoSortsParser extends SimpleSortsParser {

}

/**
 * @deprecated use {@link MongoSortsParser}. Removed in 3.0.
 */
export const MongoSortParser = MongoSortsParser;

/**
 * @deprecated use {@link MongoSortsParser}. Removed in 3.0.
 */
export type MongoSortParser = MongoSortsParser;
