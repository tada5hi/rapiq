/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import type { HookCallback, HookKeys, Hookable } from 'hookable';
import { createHooks } from 'hookable';
import type { BaseSchemaOptions } from './types';

type HookInferCallback<HT, HN extends keyof HT> = HT[HN] extends HookCallback
    ? HT[HN]
    : never;

export class BaseSchema<
    OPTIONS extends BaseSchemaOptions = BaseSchemaOptions,
    HOOKS extends Record<string, any> = Record<string, HookCallback>,
> {
    protected options: OPTIONS;

    public readonly hooks: Hookable<HOOKS>;

    // ---------------------------------------------------------

    constructor(options: OPTIONS) {
        this.options = options;
        this.hooks = createHooks<HOOKS>();
    }

    // --------------------------------------------------

    hook<NAME extends HookKeys<HOOKS>>(
        name: NAME,
        fn:HookInferCallback<HOOKS, NAME>,
    ) : CallableFunction {
        return this.hooks.hook(name, fn);
    }

    hookOnce<NAME extends HookKeys<HOOKS>>(
        name: NAME,
        fn:HookInferCallback<HOOKS, NAME>,
    ) : CallableFunction {
        return this.hooks.hookOnce(name, fn);
    }

    // ---------------------------------------------------------

    set name(input: string | undefined) {
        this.options.name = input;
    }

    get name() : string | undefined {
        return this.options.name;
    }

    // ---------------------------------------------------------

    set throwOnFailure(input: boolean | undefined) {
        this.options.throwOnFailure = input;
    }

    get throwOnFailure() : boolean | undefined {
        return this.options.throwOnFailure;
    }

    // ---------------------------------------------------------

    mapSchema(input: string) {
        if (this.options.schemaMapping) {
            return this.options.schemaMapping[input] || input;
        }

        return input;
    }
}
