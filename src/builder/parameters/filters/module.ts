/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { URLParameter } from '../../../constants';
import { FilterCompoundOperator } from '../../../schema';
import type { ObjectLiteral } from '../../../types';
import { serializeAsURI } from '../../../utils';
import { BaseBuilder } from '../../base';
import { FiltersCompoundConditionBuilder, FiltersConditionBuilder } from './entities';
import type { FiltersBuildInput } from './types';

export class FiltersBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> extends BaseBuilder<FiltersBuildInput<RECORD>> {
    public readonly value : FiltersCompoundConditionBuilder;

    // --------------------------------------------------

    constructor() {
        super();

        this.value = new FiltersCompoundConditionBuilder(FilterCompoundOperator.OR, []);
    }

    // --------------------------------------------------

    /**
     * Add multiple conditions to the builder.
     *
     * @param input
     */
    add(
        input: FiltersBuilder<RECORD> | FiltersBuildInput<RECORD> | FiltersConditionBuilder<RECORD>,
    ) {
        if (input instanceof FiltersConditionBuilder) {
            this.value.add(input);
        } else if (input instanceof FiltersBuilder) {
            this.value.add(input.value);
        } else {
            const condition = new FiltersConditionBuilder<RECORD>();
            condition.addRaw(input);
            this.value.add(condition);
        }
    }

    // --------------------------------------------------

    serialize() {
        if (this.value.value.length === 0) {
            return undefined;
        }
        return serializeAsURI(this.value.normalize(), { prefixParts: [URLParameter.FILTERS] });
    }
}
