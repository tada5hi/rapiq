/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Reserved self-reference marker (spelled `$this` on the wire).
 *
 * Legal only as the complete field of a leaf condition inside an
 * elemMatch interior, where it addresses the bound array element
 * itself instead of one of its properties:
 *
 * ```ts
 * elemMatch('scores', gt(ITSELF, 5)) // some score > 5
 * ```
 *
 * Anywhere else the marker is a typed error — build layer and parsers
 * reject it, backend adapters without element semantics
 * (`@rapiq/sql`, `@rapiq/typeorm`) throw `featureUnsupported`.
 */
export const ITSELF = '$this';
