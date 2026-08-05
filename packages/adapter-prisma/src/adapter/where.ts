/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ComparePlan,
    ConditionPlan,
    ElemMatchPlan,
    ICondition,
    MatchPlan,
    NullCheckPlan,
    OneOfPlan,
} from '@rapiq/core';
import {
    AdapterError,
    ITSELF,
    distributeNegation,
    planCondition,
} from '@rapiq/core';
import type { IMetadata } from '../metadata';
import type { ProviderOptions } from '../provider';
import type { FiltersAdapterOptions, Where } from './types';

/**
 * A folded verdict short-circuits rendering: `in([])` matches
 * nothing, `nin([])` matches everything. Keeping constants out of the
 * emitted object matters because prisma strips empty groups below the
 * root; a nested `{ OR: [] }` would silently widen the query.
 */
type Result = Where | boolean;

type Context = {
    metadata: IMetadata,
    provider: ProviderOptions,

    /**
     * Absolute path prefix of the current quantifier scope, for
     * metadata lookups.
     */
    base: string,

    /**
     * Leaf fields inside a factored scope still carry their original
     * dotted path; this prefix is removed before rendering.
     */
    strip: string,
};

type Atom = {
    plan: ConditionPlan,
    key: string,
};

/**
 * Ceiling on the number of conjuncts a mixed tree may expand to while
 * factoring quantifiers. Wire filters are tiny; a tree that exceeds
 * this is adversarial, and failing typed beats a silent semantic
 * downgrade.
 */
const EXPANSION_LIMIT = 64;

const MATCH_OPERATORS = {
    starts: 'startsWith',
    ends: 'endsWith',
    contains: 'contains',
} as const;

/**
 * `mode: 'insensitive'` lowers `equals` (and its scalar `not`) to
 * `ILIKE` with the operand passed through verbatim, so `%` and `_`
 * silently become wildcards (prisma#20318, #10810). Measured on
 * postgres 18 / prisma 6.19.3: `equals` wildcards, `in`/`notIn` never
 * do. The veto therefore applies to the equality family only; values
 * carrying either character keep the exact comparison, matching too
 * little rather than too much.
 */
const LIKE_WILDCARD = /[%_]/;

// -----------------------------------------------------------

function join(base: string, path: string) : string {
    if (!base) {
        return path;
    }

    return path ? `${base}.${path}` : base;
}

function andCombine(results: Result[]) : Result {
    const parts : Where[] = [];

    for (const result of results) {
        if (result === false) {
            return false;
        }

        if (result !== true) {
            parts.push(result);
        }
    }

    if (parts.length === 0) {
        return true;
    }

    if (parts.length === 1) {
        return parts[0] as Where;
    }

    return { AND: parts };
}

function orCombine(results: Result[]) : Result {
    const parts : Where[] = [];

    for (const result of results) {
        if (result === true) {
            return true;
        }

        if (result !== false) {
            parts.push(result);
        }
    }

    if (parts.length === 0) {
        return false;
    }

    if (parts.length === 1) {
        return parts[0] as Where;
    }

    return { OR: parts };
}

// -----------------------------------------------------------

/**
 * Renders a condition tree into a prisma `where` object, preserving
 * the cross-backend semantics contract:
 *
 * - negation is eliminated up front by the core `distributeNegation`
 *   transform, so this renderer only ever sees leaves in their final
 *   (possibly complemented) form; prisma's three-valued `not`/`NOT`
 *   is never relied upon,
 * - relation traversal quantifies existentially with the quantifier
 *   outermost, exactly like a left join evaluated per row
 *   (`@rapiq/adapter-sql`) or a binding enumeration (`@rapiq/adapter-memory`),
 * - conditions sharing a to-many path within a conjunction bind to
 *   the SAME element: they are factored into one `some` scope (mixed
 *   trees are expanded to reach that form; `∃` distributes over OR,
 *   so disjunctions need no factoring),
 * - an empty collection contributes exactly one all-null binding
 *   (the left join's null row): every quantifier gains a
 *   `{ none: {} }` arm precisely when its interior holds at that
 *   binding, and every to-one hop an absence arm under the same rule.
 */
export class WhereRenderer {
    protected metadata : IMetadata;

    protected provider : ProviderOptions;

    constructor(metadata: IMetadata, provider: ProviderOptions) {
        this.metadata = metadata;
        this.provider = provider;
    }

    // -----------------------------------------------------------

    build(condition: ICondition, options: FiltersAdapterOptions = {}) : {
        where?: Where,
        impossible: boolean,
    } {
        const plan = planCondition(condition, { caseSensitive: options.caseSensitive });
        if (!plan) {
            return { impossible: false };
        }

        const result = this.render(distributeNegation(plan), {
            metadata: this.metadata,
            provider: this.provider,
            base: '',
            strip: '',
        });

        if (result === true) {
            return { impossible: false };
        }

        if (result === false) {
            return { impossible: true };
        }

        return { where: result, impossible: false };
    }

    // -----------------------------------------------------------

    protected render(plan: ConditionPlan, ctx: Context) : Result {
        switch (plan.kind) {
            case 'constant': {
                return plan.verdict;
            }
            case 'compound': {
                if (plan.negated) {
                    // a residual wrapper only ever encloses kinds
                    // without a complement form; rendering the child
                    // raises the matching typed error. Any other kind
                    // here means the distribution invariant broke:
                    // failing typed beats silently emitting the
                    // positive (inverted) form.
                    const child = plan.children[0] as ConditionPlan;

                    if (child.kind !== 'mod' && child.kind !== 'size') {
                        throw AdapterError.featureUnsupported('filters:negation');
                    }

                    return this.render(child, ctx);
                }

                if (plan.operator === 'or') {
                    // ∃ distributes over OR, so disjuncts never share
                    // a binding and render independently.
                    return orCombine(plan.children.map((child) => this.render(child, ctx)));
                }

                return this.renderAnd(plan.children, ctx);
            }
            case 'elem-match': {
                return this.renderElemMatch(plan, ctx);
            }
            default: {
                return this.renderLeaf(plan, ctx);
            }
        }
    }

    /**
     * A conjunction is where bindings are shared: conditions on one
     * to-many path must land in one `some` scope. Children mixing
     * quantifier keys are expanded to disjunctive form first, so each
     * conjunct groups cleanly.
     */
    protected renderAnd(children: ConditionPlan[], ctx: Context) : Result {
        const flattened : ConditionPlan[] = [];
        for (const child of children) {
            if (child.kind === 'compound' && !child.negated && child.operator === 'and') {
                flattened.push(...child.children);
            } else {
                flattened.push(child);
            }
        }

        const pure : Atom[] = [];
        const mixed : ConditionPlan[] = [];

        const seen = new Set<string>();

        for (const child of flattened) {
            const keys = this.keysOf(child, ctx);
            keys.forEach((key) => seen.add(key));

            if (keys.size <= 1) {
                pure.push({ plan: child, key: keys.values().next().value ?? '' });
            } else {
                mixed.push(child);
            }
        }

        if (mixed.length === 0) {
            return this.renderConjunct(pure, ctx);
        }

        // a mixed child shares a binding with a sibling only through a
        // non-root key that occurs elsewhere too; otherwise it factors
        // internally on its own.
        const shared = mixed.some((child) => {
            const keys = this.keysOf(child, ctx);

            for (const key of keys) {
                if (!key) {
                    continue;
                }

                const elsewhere = pure.some((atom) => atom.key === key) ||
                    mixed.some((other) => other !== child && this.keysOf(other, ctx).has(key));

                if (elsewhere) {
                    return true;
                }
            }

            return false;
        });

        if (!shared) {
            return andCombine([
                this.renderConjunct(pure, ctx),
                ...mixed.map((child) => this.render(child, ctx)),
            ]);
        }

        const conjuncts = this.expand(flattened, ctx);

        return orCombine(conjuncts.map((conjunct) => this.renderConjunct(conjunct, ctx)));
    }

    /**
     * Disjunctive expansion of a conjunction whose children cross
     * quantifier scopes: the standard identity
     * `a ∧ (b ∨ c) = (a ∧ b) ∨ (a ∧ c)`, applied only as far as
     * needed: subtrees confined to a single key stay opaque atoms.
     */
    protected expand(children: ConditionPlan[], ctx: Context) : Atom[][] {
        let conjuncts : Atom[][] = [[]];

        for (const child of children) {
            const branches = this.branchesOf(child, ctx);

            const next : Atom[][] = [];
            for (const conjunct of conjuncts) {
                for (const branch of branches) {
                    next.push([...conjunct, ...branch]);
                }
            }

            if (next.length > EXPANSION_LIMIT) {
                throw AdapterError.featureUnsupported('filters:complexity');
            }

            conjuncts = next;
        }

        return conjuncts;
    }

    protected branchesOf(plan: ConditionPlan, ctx: Context) : Atom[][] {
        const keys = this.keysOf(plan, ctx);

        if (keys.size <= 1) {
            return [[{ plan, key: keys.values().next().value ?? '' }]];
        }

        // only compounds can mix keys
        const compound = plan as Extract<ConditionPlan, { kind: 'compound' }>;

        if (compound.operator === 'or') {
            const output : Atom[][] = [];
            for (const child of compound.children) {
                output.push(...this.branchesOf(child, ctx));
            }

            return output;
        }

        let conjuncts : Atom[][] = [[]];
        for (const child of compound.children) {
            const branches = this.branchesOf(child, ctx);

            const next : Atom[][] = [];
            for (const conjunct of conjuncts) {
                for (const branch of branches) {
                    next.push([...conjunct, ...branch]);
                }
            }

            if (next.length > EXPANSION_LIMIT) {
                throw AdapterError.featureUnsupported('filters:complexity');
            }

            conjuncts = next;
        }

        return conjuncts;
    }

    protected renderConjunct(atoms: Atom[], ctx: Context) : Result {
        const parts : Result[] = [];
        const groups = new Map<string, ConditionPlan[]>();

        for (const atom of atoms) {
            if (!atom.key) {
                parts.push(this.render(atom.plan, ctx));
                continue;
            }

            const group = groups.get(atom.key) ?? [];
            group.push(atom.plan);
            groups.set(atom.key, group);
        }

        groups.forEach((plans, key) => {
            parts.push(this.factor(key, plans, ctx));
        });

        return andCombine(parts);
    }

    /**
     * One `some` scope for every plan sharing the quantifier path:
     * the same-element binding of a left join, where each join row is
     * tested against ALL conditions at once.
     */
    protected factor(path: string, plans: ConditionPlan[], ctx: Context) : Result {
        const segments = path.split('.');
        const name = segments.pop() as string;

        const scoped : Context = {
            ...ctx,
            base: join(ctx.base, path),
            strip: `${ctx.strip}${path}.`,
        };

        const interior = andCombine(plans.map((plan) => this.render(plan, scoped)));
        const matchesNull = plans.every((plan) => this.evalAtNull(plan));

        let node : Result;
        if (interior === false) {
            node = false;
        } else {
            node = { [name]: { some: interior === true ? {} : interior } };
        }

        if (matchesNull) {
            // the empty collection: its left join contributes exactly
            // one all-null row, and the interior holds there.
            node = orCombine([node, { [name]: { none: {} } }]);
        }

        return this.wrapToOne(segments, node, matchesNull, ctx);
    }

    /**
     * Wrap leading to-one segments (`is`), adding the absence arm
     * when the interior holds at a null binding: an absent relation
     * is the same all-null row a left join produces.
     */
    protected wrapToOne(
        segments: string[],
        node: Result,
        matchesNull: boolean,
        _ctx: Context,
    ) : Result {
        let current = node;

        for (let i = segments.length - 1; i >= 0; i--) {
            const name = segments[i] as string;

            let branch : Result;
            if (current === false) {
                branch = false;
            } else {
                branch = { [name]: { is: current === true ? {} : current } };
            }

            if (matchesNull) {
                current = orCombine([branch, { NOT: { [name]: { is: {} } } }]);
            } else {
                current = branch;
            }
        }

        return current;
    }

    // -----------------------------------------------------------

    protected renderElemMatch(plan: ElemMatchPlan, ctx: Context) : Result {
        const relative = this.stripField(plan.field, ctx);
        const absolute = join(ctx.base, relative);

        const segments = relative.split('.');
        const name = segments.pop() as string;

        // walk any to-many prefix through the ordinary factoring path
        const key = this.keyOfPath(relative, ctx);
        if (key && key !== relative) {
            return this.factor(key, [plan], ctx);
        }

        if (this.metadata.isToMany(absolute) === false && this.metadata.isRelation(absolute)) {
            // elemMatch quantifies over elements; a to-one relation
            // has none, and prisma's own error for a `some` on it is
            // misleading.
            throw AdapterError.featureUnsupported('filters:elemMatch');
        }

        const scoped : Context = {
            ...ctx, 
            base: absolute, 
            strip: '',
        };

        const interior = this.render(plan.condition, scoped);
        const matchesNull = this.evalAtNull(plan);

        let node : Result;
        if (interior === false) {
            node = false;
        } else {
            node = { [name]: { some: interior === true ? {} : interior } };
        }

        if (matchesNull) {
            node = orCombine([node, { [name]: { none: {} } }]);
        }

        return this.wrapToOne(segments, node, matchesNull, ctx);
    }

    protected renderLeaf(plan: ConditionPlan, ctx: Context) : Result {
        const leaf = plan as Exclude<ConditionPlan, { kind: 'compound' | 'constant' | 'elem-match' }>;
        const relative = this.stripField(leaf.field, ctx);
        const absolute = join(ctx.base, relative);

        // a path traversing a to-many binds to ONE element, whatever the
        // leaf asks about it: the same-element contract applies to a
        // relation-presence leaf exactly as it does to a column leaf, so
        // the factoring gate comes first. Checking presence before it
        // opened an independent scope, which widens a conjunction and
        // turns the per-binding complement into a collection-wide one.
        const key = this.keyOfPath(relative, ctx);
        if (key) {
            return this.factor(key, [leaf], ctx);
        }

        // a null check on the relation itself addresses the value as
        // a whole, not its elements.
        if (leaf.kind === 'null-check' && this.metadata.isRelation(absolute)) {
            if (this.metadata.isToMany(absolute)) {
                // a collection is always present: possibly empty,
                // never absent, matching @rapiq/adapter-memory.
                return leaf.negated;
            }

            const present = this.presence(relative, ctx);

            return leaf.negated ? present : { NOT: present as Where };
        }

        const segments = relative.split('.');
        const name = segments.pop() as string;

        if (name === ITSELF) {
            // the bound element itself is not a column; prisma has
            // no scalar-array element filter to address it with.
            throw AdapterError.featureUnsupported('filters:itself');
        }

        return this.wrapToOne(
            segments,
            this.renderLiteral(leaf, name, absolute),
            this.evalAtNull(leaf),
            ctx,
        );
    }

    /**
     * "The relation path exists": every hop as a plain presence test,
     * two-valued by construction and therefore safe under `NOT`.
     */
    protected presence(path: string, ctx: Context) : Result {
        const segments = path.split('.');

        let node : Result = true;

        for (let i = segments.length - 1; i >= 0; i--) {
            const name = segments[i] as string;
            const absolute = join(ctx.base, segments.slice(0, i + 1).join('.'));

            const interior : Where = node === true ? {} : node as Where;

            if (this.metadata.isToMany(absolute)) {
                node = { [name]: { some: interior } };
            } else {
                node = { [name]: { is: interior } };
            }
        }

        return node;
    }

    // -----------------------------------------------------------

    protected renderLiteral(
        plan: Exclude<ConditionPlan, { kind: 'compound' | 'constant' | 'elem-match' }>,
        name: string,
        absolute: string,
    ) : Result {
        switch (plan.kind) {
            case 'null-check': {
                return this.renderNullCheck(plan, name, absolute);
            }
            case 'compare': {
                return this.renderCompare(plan, name, absolute);
            }
            case 'one-of': {
                return this.renderOneOf(plan, name, absolute);
            }
            case 'match': {
                return this.renderMatch(plan, name, absolute);
            }
            default: {
                // mod, size: no prisma operator exists.
                throw AdapterError.featureUnsupported(`filters:${plan.kind}`);
            }
        }
    }

    protected renderNullCheck(plan: NullCheckPlan, name: string, absolute: string) : Result {
        // a column that cannot hold null decides the check; prisma
        // would reject the comparison outright.
        if (this.metadata.isNullable(absolute) === false) {
            return plan.negated;
        }

        return plan.negated ?
            { [name]: { not: null } } :
            { [name]: null };
    }

    protected renderCompare(plan: ComparePlan, name: string, absolute: string) : Result {
        if (plan.op !== 'eq') {
            // ordering never carries negation after distribution: its
            // complement became the dual operator or a null check. An
            // unnoticed break of that invariant must fail typed, not
            // emit the positive (inverted) form.
            if (plan.negated) {
                throw AdapterError.featureUnsupported('filters:negation');
            }

            return { [name]: { [plan.op]: plan.value } };
        }

        const mode = this.buildMode(absolute, plan.caseFold, [plan.value]);

        if (plan.negated) {
            return this.orNull(
                name,
                { [name]: { not: plan.value, ...mode } },
                absolute,
            );
        }

        return { [name]: { equals: plan.value, ...mode } };
    }

    /**
     * The in/nin four-case contract: a null member also matches the
     * absence of a value, and the negated form is the exact
     * complement; prisma's `in`/`notIn` accept no null member and
     * skip null rows on their own.
     */
    protected renderOneOf(plan: OneOfPlan, name: string, absolute: string) : Result {
        // no wildcard veto here: `in`/`notIn` are never lowered to
        // ILIKE, so they stay case-insensitive even for values
        // carrying % or _.
        const mode = this.buildMode(
            absolute,
            plan.caseFold && plan.values.some((value) => typeof value === 'string'),
        );

        const positive = { [name]: { in: plan.values, ...mode } };
        const negative = { [name]: { notIn: plan.values, ...mode } };

        if (plan.includesNull) {
            if (plan.negated) {
                return this.andNotNull(name, negative, absolute);
            }

            if (this.metadata.isNullable(absolute) === false) {
                // the null member is dead on a required column, and
                // prisma rejects the comparison there.
                return positive;
            }

            return { OR: [positive, { [name]: null }] };
        }

        if (plan.negated) {
            return this.orNull(name, negative, absolute);
        }

        return positive;
    }

    protected renderMatch(plan: MatchPlan, name: string, absolute: string) : Result {
        if (plan.pattern.mode === 'regex') {
            // prisma exposes no regular-expression filter on any
            // connector; the anchored operators map natively instead.
            throw AdapterError.featureUnsupported('filters:regex');
        }

        const operator = MATCH_OPERATORS[plan.pattern.mode];
        const { text } = plan.pattern;
        const mode = this.buildMode(absolute, plan.ignoreCase);

        if (plan.negated) {
            // `mode` is a sibling of `not`, never nested inside it:
            // the nested filter input carries no mode member, but the
            // outer one is applied into the negated subtree.
            return this.orNull(
                name,
                { [name]: { not: { [operator]: text }, ...mode } },
                absolute,
            );
        }

        return { [name]: { [operator]: text, ...mode } };
    }

    // -----------------------------------------------------------

    /**
     * Whether the plan holds at the all-null binding an empty
     * collection (or absent to-one relation) contributes; decides the
     * `{ none: {} }` and absence arms. Deliberately independent of
     * column nullability: a left join produces null for non-nullable
     * columns too.
     */
    protected evalAtNull(plan: ConditionPlan) : boolean {
        switch (plan.kind) {
            case 'constant': {
                return plan.verdict;
            }
            case 'compound': {
                if (plan.negated) {
                    return false;
                }

                if (plan.operator === 'or') {
                    return plan.children.some((child) => this.evalAtNull(child));
                }

                return plan.children.every((child) => this.evalAtNull(child));
            }
            case 'null-check': {
                return !plan.negated;
            }
            case 'compare': {
                return plan.op === 'eq' && plan.negated;
            }
            case 'one-of': {
                return plan.negated ? !plan.includesNull : plan.includesNull;
            }
            case 'match': {
                return plan.negated;
            }
            case 'elem-match': {
                // a null collection contributes one null binding of
                // its own, matching @rapiq/adapter-memory.
                return this.evalAtNull(plan.condition);
            }
            default: {
                return false;
            }
        }
    }

    /**
     * Quantifier key of a leaf path, the prefix up to and including
     * the first to-many segment, or the empty string for paths that
     * traverse none. Leaves sharing a key share a binding.
     */
    protected keyOfPath(relative: string, ctx: Context) : string {
        const segments = relative.split('.');

        // the final segment is the addressed value, not a hop:
        // except when the leaf addresses through it (dotted).
        for (let i = 0; i < segments.length - 1; i++) {
            const prefix = segments.slice(0, i + 1).join('.');

            if (this.metadata.isToMany(join(ctx.base, prefix))) {
                return prefix;
            }
        }

        return '';
    }

    protected keysOf(plan: ConditionPlan, ctx: Context) : Set<string> {
        switch (plan.kind) {
            case 'compound': {
                const output = new Set<string>();

                for (const child of plan.children) {
                    this.keysOf(child, ctx).forEach((key) => output.add(key));
                }

                return output;
            }
            case 'constant': {
                return new Set();
            }
            case 'elem-match': {
                // an elemMatch opens its own quantifier scope and
                // never shares a binding, so it behaves like a root
                // atom unless its own path traverses a to-many first.
                const key = this.keyOfPath(this.stripField(plan.field, ctx), ctx);

                return new Set([key && key !== this.stripField(plan.field, ctx) ? key : '']);
            }
            default: {
                const leaf = plan as Extract<ConditionPlan, { field: string }>;

                // a relation-presence leaf reports the binding its path
                // traverses, like every other leaf: keyOfPath answers ''
                // when nothing to-many is crossed, so a root-level
                // presence still factors into no scope.
                return new Set([this.keyOfPath(this.stripField(leaf.field, ctx), ctx)]);
            }
        }
    }

    protected stripField(field: string, ctx: Context) : string {
        if (ctx.strip && field.startsWith(ctx.strip)) {
            return field.slice(ctx.strip.length);
        }

        return field;
    }

    // -----------------------------------------------------------

    /**
     * The case-fold policy verdict from the core lowering, narrowed
     * by the capability vetoes, the connector must accept
     * `mode: 'insensitive'`, the column must hold strings, and (for
     * the equality family only) no value may carry a LIKE wildcard.
     */
    protected buildMode(
        absolute: string,
        caseFold: boolean,
        values?: unknown[],
    ) : Record<string, string> {
        if (!caseFold || !this.provider.caseInsensitiveMode) {
            return {};
        }

        if (this.metadata.isString(absolute) === false) {
            return {};
        }

        if (
            values &&
            values.some((value) => typeof value === 'string' && LIKE_WILDCARD.test(value))
        ) {
            return {};
        }

        return { mode: 'insensitive' };
    }

    /**
     * The null arm that makes a negated leaf the exact complement of
     * its positive twin, dropped when the column provably never holds
     * null (prisma rejects the comparison there, and no null can
     * exist).
     */
    protected orNull(name: string, where: Where, absolute: string) : Where {
        if (this.metadata.isNullable(absolute) === false) {
            return where;
        }

        return { OR: [where, { [name]: null }] };
    }

    protected andNotNull(name: string, where: Where, absolute: string) : Where {
        if (this.metadata.isNullable(absolute) === false) {
            return where;
        }

        return { AND: [where, { [name]: { not: null } }] };
    }
}
