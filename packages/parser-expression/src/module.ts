/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { SchemaRegistry } from '@rapiq/core';
import { BaseQueryParser } from '@rapiq/core';
import {
    ExpressionFieldsParser,
    ExpressionFiltersParser,
    ExpressionPaginationParser,
    ExpressionRelationsParser,
    ExpressionSortParser,
} from './parameter';

export class ExpressionParser extends BaseQueryParser {
    protected fieldsParser : ExpressionFieldsParser;

    protected filtersParser : ExpressionFiltersParser;

    protected paginationParser : ExpressionPaginationParser;

    protected relationsParser : ExpressionRelationsParser;

    protected sortParser : ExpressionSortParser;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        super(input);

        this.fieldsParser = new ExpressionFieldsParser(this.registry);
        this.filtersParser = new ExpressionFiltersParser(this.registry);
        this.paginationParser = new ExpressionPaginationParser(this.registry);
        this.relationsParser = new ExpressionRelationsParser(this.registry);
        this.sortParser = new ExpressionSortParser(this.registry);
    }
}
