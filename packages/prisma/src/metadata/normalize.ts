/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { AdapterError, ErrorCode } from '@rapiq/core';
import type { Datamodel, DatamodelField, DatamodelModel } from './types';

/**
 * Anything a datamodel can be read from:
 *
 * - `Prisma.dmmf.datamodel` (models as an array), or any hand-written
 *   object of the same shape,
 * - `client.$datamodel` / `client._runtimeDataModel` (models as a
 *   record keyed by name),
 * - a `PrismaClient` instance, which carries the latter.
 *
 * The client paths prefer the public `$datamodel` reflection surface
 * (proposed in prisma/prisma#19392, implemented by prisma/prisma#29792)
 * and fall back to `_runtimeDataModel`, a private but long-stable
 * client internal verified against real generated clients by the
 * engine-backed test suite. The datamodel shapes are the
 * private-API-free path.
 */
export type DatamodelInput = Datamodel | object;

/**
 * A model delegate (`prisma.user`), or a plain model name (`'User'`).
 * The delegate resolves through its public field references, with the
 * runtime `$name` marker as the primary source.
 */
export type ModelInput = string | { fields: object };

function isField(input: unknown) : input is DatamodelField {
    return typeof input === 'object' &&
        input !== null &&
        typeof (input as DatamodelField).name === 'string' &&
        typeof (input as DatamodelField).kind === 'string';
}

function isModel(input: unknown) : input is DatamodelModel {
    return typeof input === 'object' &&
        input !== null &&
        typeof (input as DatamodelModel).name === 'string' &&
        Array.isArray((input as DatamodelModel).fields) &&
        (input as DatamodelModel).fields.every(isField);
}

/**
 * Edge and wasm builds (`engineType = "client"`) strip the runtime
 * datamodel down to names and kinds: no cardinality, no nullability.
 * Deriving metadata from that would silently degrade every adapter
 * default, so it fails here instead; a hand-written datamodel is the
 * documented escape hatch.
 */
function assertComplete(models: DatamodelModel[]) : void {
    for (const model of models) {
        for (const field of model.fields) {
            if (
                typeof field.isList !== 'boolean' ||
                typeof field.isRequired !== 'boolean'
            ) {
                throw new AdapterError({
                    message: 'The datamodel is pruned (no cardinality or nullability, ' +
                        'e.g. an edge/wasm build); supply a hand-written datamodel instead.',
                    code: ErrorCode.SCHEMA_UNRESOLVABLE,
                });
            }
        }
    }
}

/**
 * Normalize any {@link DatamodelInput} to the array-shaped datamodel
 * the metadata and schema modules consume.
 */
export function normalizeDatamodel(input: DatamodelInput) : Datamodel {
    if (typeof input === 'object' && input !== null) {
        const source = input as Record<string, any>;

        // a client instance carries the runtime datamodel: through the
        // public `$datamodel` reflection surface where a client ships
        // it (prisma/prisma#29792), through the private internal
        // otherwise
        if (source.$datamodel) {
            return normalizeDatamodel(source.$datamodel as object);
        }

        if (source._runtimeDataModel) {
            return normalizeDatamodel(source._runtimeDataModel as object);
        }

        // a malformed model (no name, no fields array, junk entries)
        // falls through to the typed throw below instead of surfacing
        // a raw TypeError from the completeness walk
        if (Array.isArray(source.models) && source.models.every(isModel)) {
            const models = source.models as DatamodelModel[];
            assertComplete(models);

            return { models };
        }

        // the runtime datamodel keys models by name and strips it
        // from the entries; an array that failed the shape guard above
        // must not leak in here (its indices would become model names)
        if (
            typeof source.models === 'object' &&
            source.models !== null &&
            !Array.isArray(source.models)
        ) {
            const models : DatamodelModel[] = [];

            for (const [name, model] of Object.entries(source.models as Record<string, any>)) {
                if (!model || !Array.isArray(model.fields)) {
                    continue;
                }

                models.push({ name, fields: model.fields.filter(isField) });
            }

            if (models.length > 0) {
                assertComplete(models);

                return { models };
            }
        }
    }

    throw new AdapterError({
        message: 'The datamodel could not be resolved: expected a datamodel, ' +
            'a runtime datamodel or a prisma client instance.',
        code: ErrorCode.SCHEMA_UNRESOLVABLE,
    });
}

/**
 * Resolve a {@link ModelInput} to the model name: a string passes
 * through, a delegate answers through its runtime `$name` marker or,
 * failing that, the `modelName` of its public field references.
 */
export function resolveModelName(input: ModelInput) : string {
    if (typeof input === 'string') {
        return input;
    }

    if (typeof input === 'object' && input !== null) {
        const source = input as Record<string, any>;

        if (typeof source.$name === 'string') {
            return source.$name;
        }

        if (typeof source.fields === 'object' && source.fields !== null) {
            for (const field of Object.values(source.fields as Record<string, any>)) {
                if (field && typeof field.modelName === 'string') {
                    return field.modelName;
                }
            }
        }

        if (typeof source.name === 'string') {
            return source.name;
        }
    }

    throw new AdapterError({
        message: 'The model could not be resolved: expected a model name or a model delegate.',
        code: ErrorCode.SCHEMA_UNRESOLVABLE,
    });
}

/**
 * The client a model delegate belongs to (`prisma.user` back to
 * `prisma`), through the runtime `$parent` backref.
 */
export function resolveDelegateClient(input: ModelInput) : object | undefined {
    if (
        typeof input === 'object' &&
        input !== null &&
        typeof (input as Record<string, any>).$parent === 'object' &&
        (input as Record<string, any>).$parent !== null
    ) {
        return (input as Record<string, any>).$parent;
    }

    return undefined;
}
