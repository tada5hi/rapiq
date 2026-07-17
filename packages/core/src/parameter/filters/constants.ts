/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Reserved self-reference marker (spelled `$this` on the wire).
 *
 * Legal only as the complete field of a condition inside an
 * elemMatch interior. A leaf condition uses it to address the bound
 * array element itself instead of one of its properties; a nested
 * elemMatch may take it as its own field for arrays of arrays:
 *
 * ```ts
 * elemMatch('scores', gt(ITSELF, 5))                     // some score > 5
 * elemMatch('matrix', elemMatch(ITSELF, gt(ITSELF, 5)))  // some row has a value > 5
 * ```
 *
 * Anywhere else the marker is a typed error — build layer and parsers
 * reject it, backend adapters without element semantics
 * (`@rapiq/sql`, `@rapiq/typeorm`) throw `featureUnsupported`.
 */
export const ITSELF = '$this';
