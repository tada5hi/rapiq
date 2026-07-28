/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode } from '@rapiq/core';
import type { DatamodelInput, ModelInput } from './normalize';
import { normalizeDatamodel, resolveModelName } from './normalize';
import type {
    Datamodel,
    DatamodelField,
    DatamodelModel,
    IMetadata,
} from './types';

const RELATION_KIND = 'object';

const STRING_TYPE = 'String';

/**
 * Answers the adapter's two metadata questions from a prisma
 * datamodel (`Prisma.dmmf.datamodel`) by walking dotted paths
 * segment by segment. Unknown segments answer `undefined`, never a
 * guess.
 */
export class Metadata implements IMetadata {
    protected models : Map<string, DatamodelModel>;

    protected root : string;

    constructor(datamodel: Datamodel, model: string) {
        this.models = new Map();
        this.root = model;

        for (const item of datamodel.models) {
            this.models.set(item.name, item);
        }

        // a misspelled root (prisma models are PascalCase, the client
        // accessors are not) would answer "unknown" to every question
        // and silently degrade the adapter to its defaults.
        if (!this.models.has(model)) {
            throw new AdapterError({
                message: `The model "${model}" is not part of the datamodel.`,
                code: ErrorCode.SCHEMA_UNRESOLVABLE,
            });
        }
    }

    // -----------------------------------------------------------

    isRelation(path: string) : boolean | undefined {
        const field = this.resolve(path);
        if (!field) {
            return undefined;
        }

        return field.kind === RELATION_KIND;
    }

    isToMany(path: string) : boolean | undefined {
        const field = this.resolve(path);
        if (!field || field.kind !== RELATION_KIND) {
            return undefined;
        }

        return field.isList;
    }

    isString(path: string) : boolean | undefined {
        const field = this.resolve(path);
        if (!field || field.kind === RELATION_KIND) {
            return undefined;
        }

        return field.type === STRING_TYPE;
    }

    isNullable(path: string) : boolean | undefined {
        const field = this.resolve(path);
        if (!field || typeof field.isRequired !== 'boolean') {
            // a pruned datamodel (edge/wasm builds) drops the flag:
            // unknown, never assumed.
            return undefined;
        }

        return !field.isRequired;
    }

    // -----------------------------------------------------------

    /**
     * Resolve a dotted path to its field descriptor: every segment but
     * the last must be a relation field, and each hop switches to the
     * related model.
     */
    protected resolve(path: string) : DatamodelField | undefined {
        const segments = path.split('.');

        let model = this.models.get(this.root);
        let field : DatamodelField | undefined;

        for (let i = 0; i < segments.length; i++) {
            if (!model) {
                return undefined;
            }

            field = model.fields.find((item) => item.name === segments[i]);
            if (!field) {
                return undefined;
            }

            if (i === segments.length - 1) {
                return field;
            }

            if (field.kind !== RELATION_KIND) {
                return undefined;
            }

            model = this.models.get(field.type);
        }

        return undefined;
    }
}

/**
 * Bind a datamodel to the model a query targets. Accepts a prisma
 * client instance, its runtime datamodel, `Prisma.dmmf.datamodel` or
 * any hand-written object of the same shape; the model is a name or
 * a model delegate.
 *
 * ```typescript
 * const metadata = defineMetadata(prisma, prisma.user);
 * // or, private-API-free:
 * const metadata = defineMetadata(Prisma.dmmf.datamodel, 'User');
 * ```
 */
export function defineMetadata(datamodel: DatamodelInput, model: ModelInput) : Metadata {
    return new Metadata(normalizeDatamodel(datamodel), resolveModelName(model));
}
