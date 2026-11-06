/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Compile-time pins for the derived wire types — checked by
 * build:types (tsc --noEmit), so a table or core-semantics change
 * that shifts the derived types fails the build, not silently
 * downstream. Deliberately NOT re-exported from the barrel: this
 * file is a static assertion, not API.
 */
