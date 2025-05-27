/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export abstract class BaseBuilder<
    INPUT = any,
> {
    abstract add(input: INPUT) : void;

    abstract serialize() : string | undefined;
}
