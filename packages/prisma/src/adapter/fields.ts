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
     * narrow it to the fieldset (#847), matching the `@rapiq/memory`
     * projection contract.
     */
    whole : boolean,

    /**
     * A pick exists somewhere in this subtree, so the level is
     * projected sparsely (`select`) instead of wholly (`include`).
     */
    refined : boolean,
};

export type Selection = {
    select?: Record<string, any>,
    include?: Record<string, any>,
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

/**
 * A pick of the property itself wins over a refinement of it:
 * `fields: ['realm', 'realm.name']` hydrates the whole relation,
 * matching the `@rapiq/memory` projection contract.
 */
function buildSelect(node: SelectionNode, children: Record<string, any>) : Record<string, any> {
    const select : Record<string, any> = { ...children };

    node.picks.forEach((pick) => {
        select[pick] = true;
    });

    node.operands.forEach((operand) => {
        select[operand] = true;
    });

    return select;
}

function materializeChildren(node: SelectionNode) : Record<string, any> {
    const output : Record<string, any> = {};

    node.children.forEach((child, name) => {
        output[name] = materialize(child);
    });

    return output;
}

function materialize(node: SelectionNode) : true | Record<string, any> {
    const children = materializeChildren(node);
    const hasChildren = Object.keys(children).length > 0;

    // an explicitly included relation without direct picks is hydrated
    // whole; deeper relations still have to be declared, and `include`
    // keeps every scalar of the level alongside them. Direct picks
    // narrow the include to the fieldset instead (#847).
    if (node.whole && node.picks.size === 0) {
        if (hasChildren) {
            return { include: children };
        }

        return true;
    }

    if (node.picks.size > 0 || node.operands.size > 0 || hasChildren) {
        return { select: buildSelect(node, children) };
    }

    return true;
}

/**
 * The `select` / `include` fragment of the argument object; empty when
 * neither fields nor relations were requested.
 *
 * `select` and `include` are mutually exclusive per level in prisma,
 * so exactly one of them is emitted: a level carrying picks is
 * projected sparsely with `select`, a level that only widens with
 * relations uses `include`. Excluded fields are simply not projected,
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
    // (`Field.condition`, rapiq#830): the gate is enforced after the fetch
    // against the rows this selection produces, and a missing operand would
    // over-redact an eq-style gate and let a negated gate disclose. Operands
    // ride as select-only entries — they never count as picks for the
    // include-narrowing veto (#847), and a whole level covers them anyway.
    for (const field of fields.value) {
        if (!field.condition || field.operator === FieldOperator.EXCLUDE) {
            continue;
        }

        // A gate is evaluated against the record its field is read from: a
        // gate on `items.secret` has operands relative to the item record.
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

    if (root.refined) {
        const select = buildSelect(root, children);

        // prisma rejects an empty select.
        if (Object.keys(select).length === 0) {
            return {};
        }

        return { select };
    }

    if (hasChildren) {
        return { include: children };
    }

    return {};
}
