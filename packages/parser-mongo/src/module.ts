/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { SchemaRegistry } from '@rapiq/core';
import { BaseQueryParser } from '@rapiq/core';
import { SimpleAggregatesParser, SimpleGroupsParser } from '@rapiq/parser-simple';
import {
    MongoFieldsParser,
    MongoFiltersParser,
    MongoPaginationParser,
    MongoRelationsParser,
    MongoSortsParser,
} from './parameter';

export class MongoParser extends BaseQueryParser {
    protected fieldsParser : MongoFieldsParser;

    protected filtersParser : MongoFiltersParser;

    protected paginationParser : MongoPaginationParser;

    protected relationsParser : MongoRelationsParser;

    protected sortParser : MongoSortsParser;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        super(input);

        this.fieldsParser = new MongoFieldsParser(this.registry);
        this.filtersParser = new MongoFiltersParser(this.registry);
        this.paginationParser = new MongoPaginationParser(this.registry);
        this.relationsParser = new MongoRelationsParser(this.registry);
        this.sortParser = new MongoSortsParser(this.registry);
        // one call-term grammar serves every dialect.
        this.groupsParser = new SimpleGroupsParser(this.registry);
        this.aggregatesParser = new SimpleAggregatesParser(this.registry);
    }
}
