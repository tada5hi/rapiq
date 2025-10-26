/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    Field,
    Fields,
    Filter,
    Filters,
    Query,
} from 'rapiq';
import type { IEncoder } from '../types';
import type { ISerializer } from './serializer';
import { QueryVisitor } from './visitors';

export class URLEncoder implements IEncoder<string | null> {
    protected visitor : QueryVisitor;

    constructor() {
        this.visitor = new QueryVisitor();
    }

    encode(input: Query): string | null {
        return this.runSerializer(this.visitor.visitQuery(input));
    }

    encodeFields(input: Fields) {
        return this.runSerializer(this.visitor.visitFields(input));
    }

    encodeField(input: Field) {
        return this.runSerializer(this.visitor.visitField(input));
    }

    encodeFilters(input: Filters) {
        return this.runSerializer(this.visitor.visitFilters(input));
    }

    encodeFilter(input: Filter) {
        return this.runSerializer(this.visitor.visitFilter(input));
    }

    protected runSerializer<T>(serializer: ISerializer<T>) : T {
        return serializer.serialize();
    }
}
