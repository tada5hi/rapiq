/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type SchemaModelMismatchErrorOptions = {
    /**
     * Name of the offending schema (a schema may be unnamed).
     */
    schema?: string,

    /**
     * Name of the model the schema was validated against.
     */
    model: string,

    /**
     * Every schema key unknown to the model.
     */
    keys: string[],
};
