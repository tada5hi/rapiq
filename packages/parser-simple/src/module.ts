/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SchemaRegistry } from '@rapiq/core';
import { BaseQueryParser } from '@rapiq/core';
import {
    SimpleFieldsParser,
    SimpleFiltersParser,
    SimplePaginationParser,
    SimpleRelationsParser,
    SimpleSortParser,
} from './parameter';

export class SimpleParser extends BaseQueryParser {
    protected fieldsParser : SimpleFieldsParser;

    protected filtersParser : SimpleFiltersParser;

    protected paginationParser : SimplePaginationParser;

    protected relationsParser : SimpleRelationsParser;

    protected sortParser : SimpleSortParser;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        super(input);

        this.fieldsParser = new SimpleFieldsParser(this.registry);
        this.filtersParser = new SimpleFiltersParser(this.registry);
        this.paginationParser = new SimplePaginationParser(this.registry);
        this.relationsParser = new SimpleRelationsParser(this.registry);
        this.sortParser = new SimpleSortParser(this.registry);
    }
}
