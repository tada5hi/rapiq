/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IInterpreter } from 'rapiq';
import {
    Relation, Relations, URLParameter,
    serializeAsURI,
} from 'rapiq';

export class RelationsInterpreter implements IInterpreter<Relations | Relation, string | null> {
    interpret(input: Relations | Relation): string | null {
        const output = this.visit(input);

        return serializeAsURI(
            output,
            {
                prefixParts: [URLParameter.RELATIONS],
            },
        );
    }

    protected visit(input: Relations | Relation) : string[] {
        const output : string[] = [];

        if (input instanceof Relations) {
            for (let i = 0; i < input.value.length; i++) {
                const child = this.visit(input.value[i]);
                output.push(...child);
            }
        }

        if (input instanceof Relation) {
            output.push(input.name);
        }

        return output;
    }
}
