/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Separates the property name of a binding-path segment from the
 * elemMatch scope discriminator (e.g. items + separator + 1). Every
 * elemMatch node opens its own quantifier scope, so two elemMatches
 * on one field bind independent elements; the NUL byte keeps
 * discriminated segments out of the real property namespace.
 */
export const BINDING_SCOPE_SEPARATOR = '\u0000';

/**
 * Context-key suffix flagging whether the value bound to a path is a
 * real array element (as opposed to a to-one object, a scalar or the
 * NULL row of a missing/empty source). ITSELF leaves only match real
 * elements - mongo's $elemMatch never matches non-arrays.
 */
export const BINDING_ELEMENT_FLAG = '\u0000*';
