/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { 
    FilterFieldOperator, 
    IFilter, 
    IFilterVisitor, 
    IFilters, 
    IFiltersVisitor, 
} from '@rapiq/core';
import {
    AdapterError,
    FilterCompoundOperator,
    FilterRegexFlag,
    ITSELF,
    createFilterRegex,
    isFilter,
    isFilters,
} from '@rapiq/core';
import {
    compareValues,
    isValueEqual,
    normalizeValue,
    resolveProperty,
    toText,
} from '../../helpers';
import { BINDING_ELEMENT_FLAG, BINDING_SCOPE_SEPARATOR } from './constants';
import type { FilterCompileResult, FiltersVisitorOptions, ValueTest } from './types';

/**
 * Positive leaf tests treat an array value by element
 * (membership semantics where SQL has no array columns).
 */
function anyValue(test: ValueTest) : ValueTest {
    return (value) => {
        if (Array.isArray(value)) {
            return value.some((element) => test(normalizeValue(element)));
        }

        return test(value);
    };
}

/**
 * Compiles a condition tree into per-binding evaluation functions and
 * collects the relation paths the tree references. Field prefixes compose
 * through elemMatch exactly like the SQL adapter, so conditions sharing a
 * relation path bind to the same array element.
 */
export class FiltersCompiler implements IFiltersVisitor<FilterCompileResult>,
    IFilterVisitor<FilterCompileResult> {
    public readonly paths : Set<string>;

    protected fieldPrefix : string;

    protected bindingPrefix : string;

    protected scopeSequence : number;

    protected caseSensitiveAll : boolean;

    protected caseSensitiveFields : Set<string>;

    constructor(options: FiltersVisitorOptions = {}) {
        this.paths = new Set();
        this.fieldPrefix = '';
        this.bindingPrefix = '';
        this.scopeSequence = 0;
        this.caseSensitiveAll = options.caseSensitive === true;
        this.caseSensitiveFields = new Set(
            Array.isArray(options.caseSensitive) ? options.caseSensitive : [],
        );
    }

    // -----------------------------------------------------------

    visitFilterEqual(expr: IFilter<FilterFieldOperator.EQUAL>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildEqualTest(expr.value, expr.field));
    }

    visitFilterNotEqual(expr: IFilter<FilterFieldOperator.NOT_EQUAL>) : FilterCompileResult {
        const test = this.buildEqualTest(expr.value, expr.field);

        return this.leaf(expr.field, (value) => !test(value));
    }

    visitFilterLessThan(expr: IFilter<FilterFieldOperator.LESS_THAN>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildCompareTest(expr.value, -1, -1));
    }

    visitFilterLessThanEqual(expr: IFilter<FilterFieldOperator.LESS_THAN_EQUAL>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildCompareTest(expr.value, -1, 0));
    }

    visitFilterGreaterThan(expr: IFilter<FilterFieldOperator.GREATER_THAN>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildCompareTest(expr.value, 1, 1));
    }

    visitFilterGreaterThanEqual(expr: IFilter<FilterFieldOperator.GREATER_THAN_EQUAL>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildCompareTest(expr.value, 0, 1));
    }

    visitFilterExists(expr: IFilter<FilterFieldOperator.EXISTS, boolean>) : FilterCompileResult {
        if (expr.value) {
            return this.leaf(expr.field, (value) => value !== null);
        }

        return this.leaf(expr.field, (value) => value === null);
    }

    visitFilterIn(expr: IFilter<FilterFieldOperator.IN, unknown[]>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildInTest(expr.value, expr.field));
    }

    visitFilterNotIn(expr: IFilter<FilterFieldOperator.NOT_IN, unknown[]>) : FilterCompileResult {
        const test = this.buildInTest(expr.value, expr.field);

        return this.leaf(expr.field, (value) => !test(value));
    }

    visitFilterMod(expr: IFilter<FilterFieldOperator.MOD, [number, number]>) : FilterCompileResult {
        if (
            !Array.isArray(expr.value) ||
            expr.value.length !== 2 ||
            !Number.isFinite(expr.value[0]) ||
            !Number.isFinite(expr.value[1]) ||
            expr.value[0] === 0
        ) {
            return this.leaf(expr.field, () => false);
        }

        const [divisor, remainder] = expr.value;

        return this.leaf(expr.field, anyValue(
            (value) => typeof value === 'number' &&
                Number.isFinite(value) &&
                value % divisor === remainder,
        ));
    }

    visitFilterSize(expr: IFilter<FilterFieldOperator.SIZE, number>) : FilterCompileResult {
        if (
            typeof expr.value !== 'number' ||
            !Number.isInteger(expr.value) ||
            expr.value < 0
        ) {
            return this.leaf(expr.field, () => false);
        }

        const length = expr.value;

        // the condition addresses the array itself, not its elements —
        // missing or non-array values never match (mongo parity).
        return this.leaf(expr.field, (value) => Array.isArray(value) &&
            value.length === length);
    }

    visitFilterElemMatch(expr: IFilter<FilterFieldOperator.ELEM_MATCH, IFilter | IFilters>) : FilterCompileResult {
        if (!isFilter(expr.value) && !isFilters(expr.value)) {
            throw AdapterError.featureUnsupported('filters:elemMatch:value');
        }

        // an elemMatch on the element itself (arrays of arrays) is
        // only meaningful inside another elemMatch scope.
        if (expr.field === ITSELF && !this.bindingPrefix) {
            throw AdapterError.featureUnsupported('filters:itself');
        }

        const oldFieldPrefix = this.fieldPrefix;
        const oldBindingPrefix = this.bindingPrefix;

        // every elemMatch opens its own quantifier scope: the
        // discriminated segment gives this interior an element binding
        // of its own, so two elemMatches on one field quantify
        // independently (e.g. one per $all value).
        this.scopeSequence += 1;
        this.fieldPrefix = `${oldFieldPrefix}${expr.field}.`;
        this.bindingPrefix = `${oldBindingPrefix}${expr.field}${BINDING_SCOPE_SEPARATOR}${this.scopeSequence}.`;

        try {
            return expr.value.accept(this);
        } finally {
            this.fieldPrefix = oldFieldPrefix;
            this.bindingPrefix = oldBindingPrefix;
        }
    }

    visitFilterStartsWith(expr: IFilter<FilterFieldOperator.STARTS_WITH>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildAnchoredTest(expr.value, FilterRegexFlag.STARTS_WITH));
    }

    visitFilterNotStartsWith(expr: IFilter<FilterFieldOperator.NOT_STARTS_WITH>) : FilterCompileResult {
        const test = this.buildAnchoredTest(expr.value, FilterRegexFlag.STARTS_WITH);

        return this.leaf(expr.field, (value) => !test(value));
    }

    visitFilterEndsWith(expr: IFilter<FilterFieldOperator.ENDS_WITH>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildAnchoredTest(expr.value, FilterRegexFlag.ENDS_WITH));
    }

    visitFilterNotEndsWith(expr: IFilter<FilterFieldOperator.NOT_ENDS_WITH>) : FilterCompileResult {
        const test = this.buildAnchoredTest(expr.value, FilterRegexFlag.ENDS_WITH);

        return this.leaf(expr.field, (value) => !test(value));
    }

    visitFilterContains(expr: IFilter<FilterFieldOperator.CONTAINS>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildAnchoredTest(expr.value, FilterRegexFlag.CONTAINS));
    }

    visitFilterNotContains(expr: IFilter<FilterFieldOperator.NOT_CONTAINS>) : FilterCompileResult {
        const test = this.buildAnchoredTest(expr.value, FilterRegexFlag.CONTAINS);

        return this.leaf(expr.field, (value) => !test(value));
    }

    visitFilterRegex(expr: IFilter<FilterFieldOperator.REGEX, RegExp | string>) : FilterCompileResult {
        return this.leaf(expr.field, this.buildRegexTest(this.buildRegex(expr.value)));
    }

    visitFilter(expr: IFilter) : FilterCompileResult {
        throw AdapterError.operatorUnsupported(expr.operator);
    }

    visitFilters(expr: IFilters) : FilterCompileResult {
        if (
            expr.operator !== FilterCompoundOperator.AND &&
            expr.operator !== FilterCompoundOperator.OR
        ) {
            throw AdapterError.operatorUnsupported(expr.operator);
        }

        const children : NonNullable<FilterCompileResult>[] = [];
        for (let i = 0; i < expr.value.length; i++) {
            const child = expr.value[i];
            if (!child) {
                continue;
            }

            if (isFilter(child) || isFilters(child)) {
                const compiled = child.accept(this);
                if (compiled) {
                    children.push(compiled);
                }
            }
        }

        // an empty compound vanishes, exactly like an empty
        // child adapter in the SQL merge step.
        if (children.length === 0) {
            return null;
        }

        if (expr.operator === FilterCompoundOperator.OR) {
            return (ctx, root) => children.some((child) => child(ctx, root));
        }

        return (ctx, root) => children.every((child) => child(ctx, root));
    }

    // -----------------------------------------------------------

    protected leaf(field: string, test: ValueTest) : FilterCompileResult {
        if (field === ITSELF) {
            // the marker addresses the element bound by the enclosing
            // elemMatch scope; outside one it has no referent.
            if (!this.bindingPrefix) {
                throw AdapterError.featureUnsupported('filters:itself');
            }

            const path = this.bindingPrefix.slice(0, -1);
            const flag = `${path}${BINDING_ELEMENT_FLAG}`;

            this.registerPath(path);

            return (ctx) => ctx.get(flag) === true &&
                test(normalizeValue(ctx.get(path)));
        }

        const key = `${this.bindingPrefix}${field}`;
        const separatorIndex = key.lastIndexOf('.');

        if (separatorIndex === -1) {
            return (_ctx, root) => test(resolveProperty(root, key));
        }

        const path = key.slice(0, separatorIndex);
        const name = key.slice(separatorIndex + 1);

        this.registerPath(path);

        return (ctx) => test(resolveProperty(ctx.get(path), name));
    }

    protected registerPath(path: string) : void {
        const segments = path.split('.');

        for (let i = 0; i < segments.length; i++) {
            this.paths.add(segments.slice(0, i + 1).join('.'));
        }
    }

    // -----------------------------------------------------------

    protected buildEqualTest(input: unknown, field: string) : ValueTest {
        return anyValue(this.buildValueEqualTest(input, field));
    }

    /**
     * Single-value equality: string conditions compare case-insensitively
     * (mirroring the SQL adapter's lower()-wrapped rendering) unless the
     * field is opted out via the `caseSensitive` option — either listed
     * by key or globally via `caseSensitive: true`.
     */
    protected buildValueEqualTest(input: unknown, field: string) : ValueTest {
        const condition = normalizeValue(input);

        if (
            typeof condition === 'string' &&
            !this.isCaseSensitive(field)
        ) {
            const lowered = condition.toLowerCase();

            return (value) => typeof value === 'string' &&
                value.toLowerCase() === lowered;
        }

        return (value) => isValueEqual(value, condition);
    }

    protected isCaseSensitive(field: string) : boolean {
        return this.caseSensitiveAll ||
            this.caseSensitiveFields.has(`${this.fieldPrefix}${field}`);
    }

    protected buildCompareTest(input: unknown, min: number, max: number) : ValueTest {
        const condition = normalizeValue(input);

        return anyValue((value) => {
            const result = compareValues(value, condition);
            if (result === undefined) {
                return false;
            }

            return result >= min && result <= max;
        });
    }

    protected buildInTest(input: unknown[], field: string) : ValueTest {
        if (!Array.isArray(input)) {
            return () => false;
        }

        const tests = input.map((item) => this.buildValueEqualTest(item, field));

        return anyValue(
            (value) => tests.some((test) => test(value)),
        );
    }

    protected buildAnchoredTest(input: unknown, flag: number) : ValueTest {
        return this.buildRegexTest(createFilterRegex(`${input}`, flag));
    }

    protected buildRegexTest(regex: RegExp) : ValueTest {
        return anyValue((value) => {
            const text = toText(value);
            if (text === undefined) {
                return false;
            }

            return regex.test(text);
        });
    }

    protected buildRegex(input: unknown) : RegExp {
        if (input instanceof RegExp) {
            // rebuild without the stateful flags, so repeated
            // test() calls never depend on lastIndex.
            return new RegExp(input.source, input.flags.replace(/[gy]/g, ''));
        }

        if (typeof input === 'string') {
            try {
                return new RegExp(input);
            } catch {
                throw AdapterError.featureUnsupported('filters:regex:value');
            }
        }

        throw AdapterError.featureUnsupported('filters:regex:value');
    }
}
