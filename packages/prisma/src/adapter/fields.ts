/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IFields } from '@rapiq/core';
import { FieldOperator } from '@rapiq/core';

type SelectionNode = {
    /**
     * Scalar field names picked at this level.
     */
    picks : Set<string>,

    children : Map<string, SelectionNode>,

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
        whole: false,
        refined: false,
    };
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

    if (node.picks.size > 0 || hasChildren) {
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
