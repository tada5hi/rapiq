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
import { BuildCompoundCondition, BuildFieldsCondition } from './conditions';
import type { FiltersBuildInput } from './types';

export class FiltersBuilder<
    RECORD extends ObjectLiteral = ObjectLiteral,
> extends BaseBuilder<FiltersBuildInput<RECORD>> {
    protected value : BuildCompoundCondition;

    // --------------------------------------------------

    constructor() {
        super();

        this.value = new BuildCompoundCondition(FilterCompoundOperator.OR, []);
    }

    // --------------------------------------------------

    /**
     * Add multiple conditions to the builder.
     *
     * @param input
     */
    add(
        input: FiltersBuildInput<RECORD> | BuildFieldsCondition<RECORD>,
    ) {
        let fields : BuildFieldsCondition<RECORD>;

        if (input instanceof BuildFieldsCondition) {
            fields = input;
        } else {
            fields = new BuildFieldsCondition();
            fields.addRaw(input);
        }

        this.value.add(fields);
    }

    // --------------------------------------------------

    serialize() {
        if (this.value.value.length === 0) {
            return undefined;
        }
        return serializeAsURI(this.value.normalize(), { prefixParts: [URLParameter.FILTERS] });
    }
}
