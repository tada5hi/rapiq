/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { toIssuePath } from '../../utils';
import { Parameter } from '../../constants';
import { ErrorCode, ErrorMessage, SchemaError } from '../../errors';
import type { ParseError } from '../../errors';
import type { ICondition } from '../../parameter';
import { isCondition } from '../../parameter';
import type { IIssueCollector } from '../issue';
import type {
    KeyValidationVerdict,
    KeyValidationVerdictRecord,
} from '../../schema';
import type { MaybeAsync } from '../../types';

/**
 * The slice of a parameter schema the key-validation pass consumes —
 * implemented by RelationsSchema, FieldsSchema and SortsSchema. The
 * batched members are optional, so an external implementation without
 * them stays source compatible and is simply driven per key.
 */
export type KeyValidatableSchema = {
    readonly name?: string,
    /**
     * The parameter this schema governs. Declared once by the schema
     * (the sub-schema classes set it in their constructors); the
     * driver derives the condition rules from it per entry, so mixed
     * obligation pools (a relation ledger fed by every parameter) need
     * no caller-side annotation.
     */
    readonly parameter: `${Parameter}`,
    hasValidator() : boolean,
    hasManyValidator?() : boolean,
    /**
     * The caller supplies only the dotted relation path of the position
     * being validated (`''` at the query root); the schema completes the
     * {@link KeyValidationScope} its hook receives from what it already
     * knows about itself. The path is REQUIRED on this driver contract:
     * an omitted path would silently claim the root position, which
     * fails open for an allow-at-root hook. (The schema classes default
     * it for direct human calls; a defaulted method still satisfies the
     * required signature.)
     */
    validate(
        name: string,
        context: any,
        path: string,
    ) : MaybeAsync<KeyValidationVerdict>,
    validateMany?(
        names: string[],
        context: any,
        path: string,
    ) : MaybeAsync<KeyValidationVerdictRecord>,
};

/**
 * A client-requested key whose governing schema may carry a validate
 * hook. Parsers record one entry per resolved key during resolution
 * and evaluate them once the parameter is assembled, so the sync and
 * async entry points share a single resolution pass.
 */
export type PendingKeyValidation = {
    /**
     * The hook argument — the canonical key relative to the schema
     * that governs it (the target schema for dotted input).
     */
    key: string,
    /**
     * Final dotted output name; parsers prefix it with the relation
     * segment while their recursion unwinds. Used for pruning.
     */
    path: string,
    schema: KeyValidatableSchema,
    /**
     * The failure policy of the scope that resolved this key, recorded
     * at push time so a child schema's own `throwOnFailure` governs its
     * rejections even inside a pooled pending list. Falls back to the
     * pass-wide {@link KeyValidationOptions.throwOnFailure} when absent
     * (the relation ledger, whose policy is the root relations schema's
     * by contract).
     */
    throwOnFailure?: boolean,
};

export type KeyValidationOptions = {
    throwOnFailure: boolean,
    errors: typeof ParseError,
    /**
     * Trace of the enclosing parse. A rejection records an issue there and
     * lets the parse continue on the drop path; the owning call raises it.
     */
    issueCollector?: IIssueCollector,
    /**
     * Sink for the conditions of condition-gated keys, keyed by output
     * path. Supplied by callers that can carry a condition onward (the
     * fields parsers, onto the `Field` node). Absent means a condition
     * verdict has nowhere to go and counts as a rejection.
     */
    conditions?: Map<string, ICondition>,
};

/**
 * Evaluate the recorded validate-hook obligations. Returns the output
 * names (paths) of rejected keys for the caller to prune — or throws
 * the parameter's ParseError (`ErrorCode.KEY_VALIDATE_REJECTED`) under
 * `throwOnFailure`, naming the full client-facing path. Duplicate
 * obligations (the same key recorded twice, e.g. from duplicated
 * client input) invoke the hook once. A hook returning a Promise here
 * means the caller sits behind a synchronous `parse()`; that is
 * refused the same way as an async filters validator.
 */
export function applyKeySchemaValidation(
    pending: PendingKeyValidation[],
    context: unknown,
    options: KeyValidationOptions,
) : string[] {
    const rejected : string[] = [];
    const entries = dedupe(pending);
    const batches = new BatchCache();

    for (const entry of entries) {
        if (!entry.schema.hasValidator()) {
            continue;
        }

        let verdict : KeyValidationVerdict;

        if (entry.schema.hasManyValidator?.()) {
            const record = batches.resolve(
                entry,
                entries,
                (schema, names, path) => refuseAsync(schema.validateMany!(names, context, path)),
            );

            verdict = refuseAsync(readVerdict(record, entry.key));
        } else {
            verdict = refuseAsync(
                entry.schema.validate(entry.key, context, scopePathOf(entry)),
            );
        }

        if (!settle(verdict, entry, options)) {
            reject(entry, options);

            rejected.push(entry.path);
        }
    }

    return rejected;
}

/**
 * Async counterpart of {@link applyKeySchemaValidation}. Hooks are
 * awaited sequentially so observable execution order matches the
 * synchronous pass.
 */
export async function applyKeySchemaValidationAsync(
    pending: PendingKeyValidation[],
    context: unknown,
    options: KeyValidationOptions,
) : Promise<string[]> {
    const rejected : string[] = [];
    const entries = dedupe(pending);
    const batches = new BatchCache();

    for (const entry of entries) {
        if (!entry.schema.hasValidator()) {
            continue;
        }

        let verdict : KeyValidationVerdict;

        if (entry.schema.hasManyValidator?.()) {
            const record = await batches.resolveAsync(
                entry,
                entries,
                (schema, names, path) => schema.validateMany!(names, context, path),
            );

            verdict = await readVerdict(record, entry.key);
        } else {
            verdict = await entry.schema.validate(entry.key, context, scopePathOf(entry));
        }

        if (!settle(verdict, entry, options)) {
            reject(entry, options);

            rejected.push(entry.path);
        }
    }

    return rejected;
}

/**
 * Memoizes one `validateMany` result per batch. The batch unit is
 * (governing schema instance, scope path): a single registered schema
 * can govern two relation positions of the same query (`items.realm`
 * and `other.realm`), and each is a distinct authorization question.
 * Batches resolve lazily, at the first deduped entry belonging to one,
 * so the hook fires in recorded order like the per-key hook does.
 */
class BatchCache {
    protected records : Map<KeyValidatableSchema, Map<string, KeyValidationVerdictRecord>>;

    constructor() {
        this.records = new Map();
    }

    resolve(
        entry: PendingKeyValidation,
        entries: PendingKeyValidation[],
        run: (
            schema: KeyValidatableSchema,
            names: string[],
            path: string,
        ) => KeyValidationVerdictRecord,
    ) : KeyValidationVerdictRecord {
        const path = scopePathOf(entry);
        const cached = this.read(entry.schema, path);
        if (cached) {
            return cached;
        }

        const record = run(
            entry.schema,
            batchKeys(entries, entry.schema, path),
            path,
        );

        return this.write(entry.schema, path, record);
    }

    async resolveAsync(
        entry: PendingKeyValidation,
        entries: PendingKeyValidation[],
        run: (
            schema: KeyValidatableSchema,
            names: string[],
            path: string,
        ) => MaybeAsync<KeyValidationVerdictRecord>,
    ) : Promise<KeyValidationVerdictRecord> {
        const path = scopePathOf(entry);
        const cached = this.read(entry.schema, path);
        if (cached) {
            return cached;
        }

        const record = await run(
            entry.schema,
            batchKeys(entries, entry.schema, path),
            path,
        );

        return this.write(entry.schema, path, record);
    }

    protected read(
        schema: KeyValidatableSchema,
        path: string,
    ) : KeyValidationVerdictRecord | undefined {
        return this.records.get(schema)?.get(path);
    }

    protected write(
        schema: KeyValidatableSchema,
        path: string,
        record: KeyValidationVerdictRecord,
    ) : KeyValidationVerdictRecord {
        let paths = this.records.get(schema);
        if (!paths) {
            paths = new Map();
            this.records.set(schema, paths);
        }

        paths.set(path, record);

        return record;
    }
}

/**
 * The dotted relation path of the schema governing an obligation.
 * Every recorded `path` ends with its `key`: root entries record
 * `path === key`, and parsers prefix a relation segment while their
 * recursion unwinds, so the remaining prefix is the governing scope.
 */
function scopePathOf(entry: PendingKeyValidation) : string {
    const offset = entry.path.length - entry.key.length - 1;
    if (offset < 0) {
        return '';
    }

    // the key must sit on a segment boundary, not merely be a suffix of the
    // path: without this, an obligation like { key: 'me', path: 'awesome' }
    // would report the governing scope as 'awes'. That path is handed to the
    // hook as an authorization input and partitions the batches, so a recorder
    // that breaks the invariant must fall back to the root rather than invent
    // a relation path that does not exist.
    if (
        entry.path.charAt(offset) !== '.' ||
        entry.path.slice(offset + 1) !== entry.key
    ) {
        return '';
    }

    return entry.path.slice(0, offset);
}

/**
 * Keys of one batch: every deduped obligation governed by `schema` at
 * `path`, in recorded order, without repeats.
 */
function batchKeys(
    entries: PendingKeyValidation[],
    schema: KeyValidatableSchema,
    path: string,
) : string[] {
    const output : string[] = [];

    for (const entry of entries) {
        if (entry.schema !== schema || scopePathOf(entry) !== path) {
            continue;
        }

        if (!output.includes(entry.key)) {
            output.push(entry.key);
        }
    }

    return output;
}

/**
 * A key absent from a batch record is rejected, mirroring the
 * `undefined`-rejects rule of the per-key hook. Read through
 * `hasOwnProperty` so inherited prototype members (`constructor`,
 * `toString`, …) cannot forge an acceptance.
 *
 * The declared record maps to plain verdicts, but a hook may hand back
 * a promise per key regardless of the type. That is settled like a
 * per-key verdict, refused by the sync driver and awaited by the async
 * one, because a thenable is truthy and would otherwise turn a hook
 * meaning "reject" into an acceptance.
 */
function readVerdict(
    record: KeyValidationVerdictRecord,
    name: string,
) : MaybeAsync<KeyValidationVerdict> {
    if (!Object.prototype.hasOwnProperty.call(record, name)) {
        return false;
    }

    return record[name];
}

/**
 * Accept, reject, or record the condition of one verdict. Returns
 * whether the key survives. A condition gates the VALUE of a projected
 * column, so it is honoured for the fields parameter only, and only
 * when the caller supplied a sink to carry it onward; a sort key or a
 * relation has no column to gate, and a condition there is refused
 * rather than silently dropped.
 */
function settle(
    verdict: KeyValidationVerdict,
    entry: PendingKeyValidation,
    options: KeyValidationOptions,
) : boolean {
    if (isCondition(verdict)) {
        if (
            options.conditions &&
            entry.schema.parameter === Parameter.FIELDS
        ) {
            options.conditions.set(entry.path, verdict);

            return true;
        }

        return false;
    }

    return !!verdict;
}

/**
 * A hook rejection: recorded into the trace when the parse collects one, and
 * thrown where it is found otherwise (a standalone pass outside a parse).
 */
function reject(
    entry: PendingKeyValidation,
    options: KeyValidationOptions,
) : void {
    const throwOnFailure = entry.throwOnFailure ?? options.throwOnFailure;

    if (options.issueCollector) {
        options.issueCollector.violation({
            code: ErrorCode.KEY_VALIDATE_REJECTED,
            parameter: entry.schema.parameter,
            path: toIssuePath(entry.path),
            message: ErrorMessage.keyValidateRejected(entry.path),
        }, throwOnFailure);

        return;
    }

    if (throwOnFailure) {
        throw options.errors.keyValidateRejected(entry.path);
    }
}

function dedupe(pending: PendingKeyValidation[]) : PendingKeyValidation[] {
    const seen = new Map<KeyValidatableSchema, Set<string>>();

    return pending.filter((entry) => {
        let paths = seen.get(entry.schema);
        if (!paths) {
            paths = new Set();
            seen.set(entry.schema, paths);
        }

        const id = `${entry.key} ${entry.path}`;
        if (paths.has(id)) {
            return false;
        }

        paths.add(id);

        return true;
    });
}

/**
 * Refuse a hook that answered asynchronously while the caller sits behind
 * a synchronous `parse()`. The pending promise is settled defensively so
 * a rejecting hook cannot surface as an unhandled rejection.
 */
function refuseAsync<T>(input: MaybeAsync<T>) : T {
    if (isPromiseLike(input)) {
        void Promise.resolve(input).catch(() => undefined);
        throw SchemaError.validatorAsyncRequiresAsyncParser();
    }

    return input;
}

function isPromiseLike(input: unknown) : input is PromiseLike<unknown> {
    return (
        input !== null &&
        (typeof input === 'object' || typeof input === 'function') &&
        'then' in input &&
        typeof input.then === 'function'
    );
}
