/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IField } from '@rapiq/core';
import { isObject, isPropertySet } from '@rapiq/core';
import type { Predicate, Projector } from '../../types';
import { FiltersVisitor } from '../filters';
import type { FiltersVisitorOptions } from '../filters';

/**
 * The visibility gates of one relation level: a predicate per gated
 * property name, plus the deeper levels reached by a dotted field name.
 */
type GateNode = {
    gates: Map<string, Predicate>,
    children: Map<string, GateNode>
};

function createGateNode() : GateNode {
    return {
        gates: new Map(),
        children: new Map(),
    };
}

function descend(node: GateNode, segments: string[]) : GateNode {
    let current = node;

    for (const segment_ of segments) {
        const segment = segment_ as string;

        let child = current.children.get(segment);
        if (!child) {
            child = createGateNode();
            current.children.set(segment, child);
        }

        current = child;
    }

    return current;
}

/**
 * Redact one level: a gated property is dropped from the output when
 * the record it is read from fails the gate condition. Copy-on-write:
 * a record with nothing to hide is passed through by reference.
 */
function redact(node: GateNode, input: unknown) : unknown {
    if (Array.isArray(input)) {
        let changed = false;

        const output = input.map((element) => {
            const value = redact(node, element);
            if (value !== element) {
                changed = true;
            }

            return value;
        });

        return changed ? output : input;
    }

    if (!isObject(input)) {
        return input;
    }

    let output : Record<string, any> = input;
    const detach = () : Record<string, any> => {
        if (output === input) {
            // keep the prototype: on the sql/typeorm post-fetch path the
            // inputs are entity class instances, and a redacted row must
            // not silently degrade to a plain object while its untouched
            // siblings stay instances.
            output = Object.assign(
                Object.create(Object.getPrototypeOf(input)),
                input,
            );
        }

        return output;
    };

    // the gates read from the untouched input, so a redacted
    // sibling can never influence another gate's verdict.
    node.gates.forEach((predicate, name) => {
        if (isPropertySet(input, name) && !predicate(input)) {
            delete detach()[name];
        }
    });

    node.children.forEach((child, segment) => {
        // presence is checked on OUTPUT: a property this level's own gate
        // just deleted must stay deleted; descending via the input would
        // resurrect it in child-redacted form.
        if (!isPropertySet(output, segment)) {
            return;
        }

        const value = redact(child, input[segment]);
        if (value !== input[segment]) {
            detach()[segment] = value;
        }
    });

    return output;
}

/**
 * Compile the visibility gates carried by the given field nodes into a
 * single redactor, or `undefined` if no field is gated.
 *
 * A gate condition is evaluated against the record the gated property is
 * read from. For a dotted name (`client.secret`) that is the related
 * record, so the condition's own field names stay relative to it, matching
 * how the projector resolves the same path. Every element of a to-many
 * relation is gated on its own.
 */
export function createFieldConditionRedactor<T = Record<string, any>>(
    fields: IField[],
    options: FiltersVisitorOptions = {},
) : Projector<T> | undefined {
    const root = createGateNode();
    let count = 0;

    const visitor = new FiltersVisitor(options);

    for (const field of fields) {
        if (!field.condition) {
            continue;
        }

        const segments = field.name.split('.');
        const name = segments.pop() as string;

        // compiled once, never per record.
        descend(root, segments).gates.set(name, visitor.compile(field.condition));
        count++;
    }

    if (count === 0) {
        return undefined;
    }

    return (input) => redact(root, input) as T;
}
