/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { ICondition, IFields } from '@rapiq/core';
import {
    FieldOperator,
    ITSELF,
    isFilter,
    isFilters,
} from '@rapiq/core';

type SelectionNode = {
    /**
     * Scalar field names picked at this level.
     */
    picks : Set<string>,

    children : Map<string, SelectionNode>,

    /**
     * Gate-operand columns (`Field.condition` reads, rapiq#830) forced
     * into the selection at this level. Selected like picks, but never
     * counted for the include-narrowing veto (#847): behind a whole
     * relation the hydration covers them anyway.
     */
    operands : Set<string>,

    /**
     * Explicitly requested through `relations`: hydrated as a whole
     * record unless direct `<relation>.<field>` picks exist — those
     * narrow it to the fieldset (#847), matching the
     * `@rapiq/adapter-memory` projection contract.
     */
    whole : boolean,

    /**
     * A pick exists somewhere in this subtree, so the level is
     * projected sparsely (`columns`) instead of wholly.
     */
    refined : boolean,
};

export type Selection = {
    columns?: Record<string, boolean>,
    with?: Record<string, any>,
};

function createNode() : SelectionNode {
    return {
        picks: new Set(),
        children: new Map(),
        operands: new Set(),
        whole: false,
        refined: false,
    };
}

/**
 * Collect the leaf fields a condition tree reads. An elemMatch leaf
 * contributes its own field (the array column) and is never descended
 * into: its interior operands are element-relative, not columns.
 */
function collectConditionFields(condition: ICondition, output: string[]) : void {
    if (isFilters(condition)) {
        for (const child of condition.value) {
            collectConditionFields(child, output);
        }

        return;
    }

    if (isFilter(condition)) {
        output.push(condition.field);
    }
}

function descend(node: SelectionNode, segments: string[]) : SelectionNode {
    let current = node;

    for (const segment of segments) {
        let child = current.children.get(segment);
        if (!child) {
            child = createNode();
            current.children.set(segment, child);
        }

        current = child;
    }

    return current;
}

function buildColumns(node: SelectionNode) : Record<string, boolean> {
    const columns : Record<string, boolean> = {};

    node.picks.forEach((pick) => {
        columns[pick] = true;
    });

    node.operands.forEach((operand) => {
        columns[operand] = true;
    });

    return columns;
}

function materializeChildren(node: SelectionNode) : Record<string, any> {
    const output : Record<string, any> = {};

    node.children.forEach((child, name) => {
        output[name] = materialize(child);
    });

    return output;
}

/**
 * A pick of the property itself wins over a refinement of it:
 * `fields: ['realm', 'realm.name']` hydrates the whole relation,
 * matching the `@rapiq/adapter-memory` projection contract.
 */
function materialize(node: SelectionNode) : true | Record<string, any> {
    const children = materializeChildren(node);
    const hasChildren = Object.keys(children).length > 0;

    // an explicitly included relation without direct picks is
    // hydrated whole; deeper relations still have to be declared, and
    // `with` alone keeps every scalar of the level alongside them.
    // Direct picks narrow the include to the fieldset instead (#847).
    if (node.whole && node.picks.size === 0) {
        if (hasChildren) {
            return { with: children };
        }

        return true;
    }

    if (node.picks.size > 0 || node.operands.size > 0 || hasChildren) {
        // an empty `columns` object is deliberate: a level reached
        // only to traverse deeper (or narrowed away entirely) keeps
        // no scalar of its own, matching the sparse `select` the
        // prisma adapter emits.
        const output : Record<string, any> = { columns: buildColumns(node) };

        if (hasChildren) {
            output.with = children;
        }

        return output;
    }

    return true;
}

/**
 * The `columns` / `with` fragment of the config object; empty when
 * neither fields nor relations were requested.
 *
 * Unlike prisma's `select`/`include`, drizzle keeps scalar selection
 * (`columns`) and relation hydration (`with`) in separate keys that
 * compose at every level. Excluded fields are simply not projected,
 * the resolution every other rapiq backend applies.
 */
export function buildSelection(fields: IFields, relationPaths: string[]) : Selection {
    const root = createNode();

    for (const field of fields.value) {
        if (field.operator === FieldOperator.EXCLUDE) {
            continue;
        }

        const segments = field.name.split('.');
        const last = segments.pop() as string;

        root.refined = true;

        let current = root;
        for (const segment of segments) {
            let child = current.children.get(segment);
            if (!child) {
                child = createNode();
                current.children.set(segment, child);
            }

            child.refined = true;
            current = child;
        }

        current.picks.add(last);
    }

    // Force-project the leaf columns a field visibility gate reads
    // (`Field.condition`, rapiq#830): the gate is enforced after the
    // fetch against the rows this selection produces, and a missing
    // operand would over-redact an eq-style gate and let a negated
    // gate disclose. Operands ride as select-only entries — they never
    // count as picks for the include-narrowing veto (#847), and a
    // whole level covers them anyway.
    for (const field of fields.value) {
        if (!field.condition || field.operator === FieldOperator.EXCLUDE) {
            continue;
        }

        // A gate is evaluated against the record its field is read
        // from: a gate on `items.secret` has operands relative to the
        // item record.
        const prefix = field.name.split('.');
        prefix.pop();

        const operands : string[] = [];
        collectConditionFields(field.condition, operands);

        for (const operand of operands) {
            // ITSELF addresses the record (or bound element) itself,
            // never a projectable column.
            if (operand === ITSELF) {
                continue;
            }

            const segments = [...prefix, ...operand.split('.')];
            const last = segments.pop() as string;

            const node = descend(root, segments);
            if (!node.picks.has(last)) {
                node.operands.add(last);
            }
        }
    }

    for (const path of relationPaths) {
        descend(root, path.split('.')).whole = true;
    }

    const children = materializeChildren(root);
    const hasChildren = Object.keys(children).length > 0;

    const output : Selection = {};

    if (root.refined) {
        // possibly `{}`: a fields parameter that picks only relation
        // columns narrows the root to no scalars at all, exactly like
        // the sparse root `select` of the prisma adapter. A root that
        // was never refined projects whole, which covers any gate
        // operands on it.
        output.columns = buildColumns(root);
    }

    if (hasChildren) {
        output.with = children;
    }

    return output;
}
