/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

export interface IInterpreter<
    Input = any,
    Output = any,
    Options extends Record<PropertyKey, any> = Record<PropertyKey, any>,
> {
    interpret(input: Input, options?: Options) : Output;
}
