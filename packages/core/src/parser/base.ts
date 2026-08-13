/*
 * Copyright (c) 2025.
 *  Author Peter Placzek (tada5hi)
 *  For the full copyright and license information,
 *  view the LICENSE file that was distributed with this source code.
 */

import { setPathValue } from 'pathtrace';
import { DEFAULT_ID, MAX_TRAVERSAL_DEPTH } from '../constants';
import type { Parameter } from '../constants';
import { ParseError, isParseError } from '../errors';
import type { Schema } from '../schema';
import { SchemaRegistry, defineSchema } from '../schema';
import type { ObjectLiteral } from '../types';
import {
    isObject, 
    isUnsafeKey, 
    parseKey, 
    stringifyKey,
} from '../utils';
import { IssueCollector, buildErrorFromIssueCollector, raiseErrorFromIssueCollector } from './issue';
import type { IIssueCollector } from './issue';
import type { IParser } from './types';

export type TempType = {
    attributes: Record<string, any>,
    relations: Record<string, TempType>
};

export abstract class BaseParser<
    OPTIONS extends ObjectLiteral = ObjectLiteral,
    OUTPUT = any,
> implements IParser<unknown, OUTPUT, OPTIONS> {
    protected registry: SchemaRegistry;

    // -----------------------------------------------------

    constructor(input?: SchemaRegistry) {
        let registry: SchemaRegistry;
        if (input instanceof SchemaRegistry) {
            registry = input;
        } else {
            registry = new SchemaRegistry();
        }

        this.registry = registry;
    }

    // --------------------------------------------------

    abstract parse(input: unknown, options?: OPTIONS): OUTPUT;

    async parseAsync(input: unknown, options?: OPTIONS) : Promise<OUTPUT> {
        return this.parse(input, options);
    }

    // --------------------------------------------------

    /**
     * The trace this parse call records into: the enclosing call's when a
     * driver handed one down (a query parse driving its five parameters), a
     * fresh one otherwise. A trace nothing raises is discarded — the error a
     * parse throws is the only way it is ever read.
     */
    protected beginIssues(driver?: IIssueCollector) : IIssueCollector {
        return driver ?? new IssueCollector();
    }

    /**
     * Raise what the trace collected, but only in the call that started it:
     * a sub-parser driven by a query parse records across all five parameters
     * and lets the orchestrator decide, so a single bad key no longer hides
     * the other four parameters' issueCollector. Every other call raises its own,
     * so a rejection can never end up recorded into a trace nobody reads.
     */
    protected finishIssues(
        driver: IIssueCollector | undefined,
        collector: IIssueCollector,
    ) : void {
        if (driver === collector) {
            return;
        }

        raiseErrorFromIssueCollector(collector);
    }

    /**
     * Run a parse body whose failures belong in `issueCollector`.
     *
     * A structural failure (a malformed expression, an input of the wrong
     * shape, a hostile key) aborts by throwing rather than by dropping one
     * key, so without this it would escape the call before anything recorded
     * it: the caller would catch an error whose `issueCollector` is empty, and
     * `formatErrors(error.issues)` — the documented way to render a
     * failure — would answer with nothing at all.
     *
     * Recorded, the throw is re-raised through the trace, so the error that
     * leaves is the FIRST violation with the whole trace attached (an earlier
     * recorded rejection still wins over a structural abort that follows it).
     * A call driven by an enclosing parse records nothing here and simply
     * propagates: that parse catches the abort per parameter, keeps the other
     * four parsing, and decides.
     */
    protected recordFailure<T>(
        driver: IIssueCollector | undefined,
        issueCollector: IIssueCollector,
        parameter: `${Parameter}`,
        fn: () => T,
    ) : T {
        try {
            return fn();
        } catch (e) {
            throw this.failure(e, driver, issueCollector, parameter);
        }
    }

    protected async recordFailureAsync<T>(
        driver: IIssueCollector | undefined,
        issueCollector: IIssueCollector,
        parameter: `${Parameter}`,
        fn: () => Promise<T>,
    ) : Promise<T> {
        try {
            return await fn();
        } catch (e) {
            throw this.failure(e, driver, issueCollector, parameter);
        }
    }

    /**
     * The error a caught throw should leave the call as.
     */
    protected failure(
        input: unknown,
        driver: IIssueCollector | undefined,
        issueCollector: IIssueCollector,
        parameter: `${Parameter}`,
    ) : unknown {
        if (
            !isParseError(input) ||
            driver === issueCollector
        ) {
            return input;
        }

        if (!issueCollector.failed) {
            issueCollector.error(input, parameter);
        }

        return buildErrorFromIssueCollector(issueCollector) ?? input;
    }

    protected getBaseSchema<
        RECORD extends ObjectLiteral = ObjectLiteral,
    >(
        input?: string | Schema<RECORD>,
    ) : Schema<RECORD> {
        let schema : Schema<RECORD> | undefined;
        if (input) {
            schema = this.registry.getOrFail(input);
        } else {
            schema = defineSchema();
        }

        return schema;
    }

    /**
     * Expand dotted keys and nested objects into one canonical tree.
     * Every leaf is written via its full dotted path, so a dotted key
     * and a nested object sharing a prefix (`{'realm.id': 1, realm:
     * {name: 'x'}}`) merge instead of the later key replacing the
     * earlier subtree. Paths are capped at the shared traversal depth:
     * a crafted deeply nested (or cyclic) input must fail typed instead
     * of overflowing the call stack — no valid path exceeds the cap,
     * since relation traversal is bounded by the same constant.
     */
    protected expandObject(
        input: Record<string, any>,
        output: Record<string, any> = {},
        prefix?: string,
    ) {
        const depth = prefix ? prefix.split('.').length : 0;

        const keys = Object.keys(input);
        for (const key of keys) {
            if (depth + key.split('.').length > MAX_TRAVERSAL_DEPTH) {
                throw ParseError.inputInvalid();
            }

            if (isUnsafeKey(key)) {
                throw ParseError.inputInvalid();
            }

            const path = prefix ? `${prefix}.${key}` : key;
            if (isObject(input[key])) {
                this.expandObject(input[key], output, path);
            } else {
                setPathValue(output, path, input[key]);
            }
        }

        return output;
    }

    /**
     * Reject an input object carrying a key whose path addresses an
     * inherited prototype member. A parameter parser that never expands
     * or groups its keys (pagination) does not run the hardened helpers
     * above, but must not accept such keys silently either — the guard
     * contract is uniform across every parameter. Nesting is bounded by
     * the shared traversal depth for the same reason as `expandObject`.
     */
    protected assertSafeObjectKeys(
        input: Record<string, any>,
        depth = 0,
    ) {
        const keys = Object.keys(input);
        for (const key of keys) {
            if (depth + key.split('.').length > MAX_TRAVERSAL_DEPTH) {
                throw ParseError.inputInvalid();
            }

            if (isUnsafeKey(key)) {
                throw ParseError.inputInvalid();
            }

            if (isObject(input[key])) {
                this.assertSafeObjectKeys(input[key], depth + key.split('.').length);
            }
        }
    }

    protected groupObject(input: Record<string, any>) {
        const output : TempType = {
            attributes: Object.create(null),
            relations: Object.create(null),
        };

        const keys = Object.keys(input);
        for (const key of keys) {
            if (isUnsafeKey(key)) {
                throw ParseError.inputInvalid();
            }

            if (isObject(input[key])) {
                output.relations[key] = this.groupObject(input[key]);
            } else {
                output.attributes[key] = input[key];
            }
        }

        return output;
    }

    protected groupObjectByBasePath<T extends Record<string, any>>(
        input: T,
    ) : Record<string, T> {
        const output : Record<string, T> = Object.create(null);

        const keys = Object.keys(input);

        this.groupByFieldPathWithFn(
            keys,
            (prefix, key, index) => {
                if (!output[prefix]) {
                    output[prefix] = Object.create(null) as T;
                }

                const sourceKey = keys[index];
                if (sourceKey !== undefined) {
                    output[prefix][key as keyof T] = input[sourceKey] as T[keyof T];
                }
            },
        );

        return output;
    }

    protected groupArrayByBasePath(
        input: string[],
    ) : Record<string, string[]> {
        const output : Record<string, string[]> = Object.create(null);

        this.groupByFieldPathWithFn(
            input,
            (prefix, key) => {
                if (!output[prefix]) {
                    output[prefix] = [];
                }

                output[prefix].push(key);
            },
        );

        return output;
    }

    /**
     * Group keys by everything before their last path segment
     * (e.g. "items.realm.id" -> { 'items.realm': ['id'] }).
     */
    protected groupArrayByKeyPath(
        input: string[],
    ) : Record<string, string[]> {
        const output : Record<string, string[]> = Object.create(null);

        for (const element of input) {
            let key : string;
            let name : string;

            if (isUnsafeKey(element)) {
                throw ParseError.inputInvalid();
            }

            const lastIndex = element.lastIndexOf('.');
            if (lastIndex === -1) {
                key = DEFAULT_ID;
                name = element;
            } else {
                key = element.substring(0, lastIndex);
                name = element.substring(lastIndex + 1);
            }

            const list = output[key] ?? [];
            output[key] = list;
            list.push(name);
        }

        return output;
    }

    protected groupByFieldPathWithFn(
        items: string[],
        cb: (
            prefix: string,
            key: string,
            index: number,
        ) => void,
    ) : void {
        for (const [i, item] of items.entries()) {
            if (isUnsafeKey(item)) {
                throw ParseError.inputInvalid();
            }

            const key = parseKey(item);

            let prefix : string;
            if (key.path) {
                const dotIndex = key.path.indexOf('.');
                if (dotIndex === -1) {
                    prefix = key.path;
                    key.path = undefined;
                } else {
                    prefix = key.path.substring(0, dotIndex);
                    key.path = key.path.substring(dotIndex + 1);
                }
            } else {
                prefix = DEFAULT_ID;
            }

            cb(prefix, stringifyKey(key), i);
        }
    }
}
