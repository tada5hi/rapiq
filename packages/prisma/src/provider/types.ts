/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export type ProviderOptions = {
    /**
     * Whether the connector accepts `mode: 'insensitive'` on string
     * filters. The rapiq case contract (eq/ne/in/nin and the anchored
     * operators compare case-insensitively by default) is expressed
     * with that flag where it exists.
     *
     * Connectors whose default collation already compares
     * case-insensitively (mysql, sqlserver) set this to `false`:
     * exactly like the identity `caseFold` of the `@rapiq/sql`
     * mysql/mssql dialects.
     */
    caseInsensitiveMode: boolean,
};
