/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { IField, IFields, IFieldsVisitor } from '@rapiq/core';
import { FieldOperator, isObject, isPropertySet } from '@rapiq/core';
import type { Projector } from '../../types';
import { createFieldConditionRedactor } from './condition';
import type { FieldsVisitorOptions } from './types';

type KeepNode = {
    keepAll: boolean,
    picks: Set<string>,
    children: Map<string, KeepNode>
};

function createKeepNode() : KeepNode {
    return {
        keepAll: false,
        picks: new Set(),
        children: new Map(),
    };
}

function descend(node: KeepNode, segments: string[]) : KeepNode {
    let current = node;

    for (const segment_ of segments) {
        const segment = segment_ as string;

        let child = current.children.get(segment);
        if (!child) {
            child = createKeepNode();
            current.children.set(segment, child);
        }

        current = child;
    }

    return current;
}

function project(node: KeepNode, input: unknown) : unknown {
    // a widened node without narrowed descendants passes the subtree
    // through by reference.
    if (node.keepAll && node.children.size === 0) {
        return input;
    }

    if (Array.isArray(input)) {
        return input
            .map((element) => project(node, element))
            .filter((element) => typeof element !== 'undefined');
    }

    if (!isObject(input)) {
        if (node.keepAll) {
            return input;
        }

        // a refined node only lets the absent value through —
        // any other unpicked scalar would leak.
        if (input === null || typeof input === 'undefined') {
            return input;
        }

        return undefined;
    }

    if (node.keepAll) {
        // a widened node keeps every member, but a descendant carrying its
        // own picks still projects sparsely (#847): `include=role` +
        // `fields[role.realm]=id` keeps the whole role except realm.
        const output : Record<string, any> = { ...input };

        node.children.forEach((child, segment) => {
            if (isPropertySet(input, segment)) {
                const value = project(child, input[segment]);
                if (typeof value !== 'undefined') {
                    output[segment] = value;
                } else {
                    delete output[segment];
                }
            }
        });

        return output;
    }

    const output : Record<string, any> = {};

    node.children.forEach((child, segment) => {
        if (isPropertySet(input, segment)) {
            const value = project(child, input[segment]);
            if (typeof value !== 'undefined') {
                output[segment] = value;
            }
        }
    });

    // a pick of the property itself wins over a refinement of it.
    node.picks.forEach((name) => {
        if (isPropertySet(input, name)) {
            output[name] = input[name];
        }
    });

    return output;
}

export class FieldsVisitor<T = Record<string, any>> implements IFieldsVisitor<Projector<T>> {
    protected options : FieldsVisitorOptions;

    constructor(options: FieldsVisitorOptions = {}) {
        this.options = options;
    }

    visitFields(expr: IFields) : Projector<T> {
        // the gates run BEFORE the projection: a gate condition may read
        // a property the field selection does not keep.
        const redactor = createFieldConditionRedactor<T>(
            expr.value,
            this.options.filters,
        );

        const picks = expr.value.filter(
            (field) => field.operator !== FieldOperator.EXCLUDE,
        );

        if (picks.length === 0) {
            return redactor || ((input) => input);
        }

        const root = createKeepNode();

        for (const pick of picks) {
            const segments = (pick as IField).name.split('.');
            const name = segments.pop() as string;

            descend(root, segments).picks.add(name);
        }

        // An included relation widens to its whole subtree UNLESS the
        // selection carries direct picks for it — then the fieldset governs
        // (#847). Every traversed prefix of an included path is itself
        // included, so each prefix node widens under the same veto.
        const relations = this.options.relations || [];
        for (const relation of relations) {
            const segments = (relation as string).split('.');

            for (let i = 1; i <= segments.length; i++) {
                const node = descend(root, segments.slice(0, i));
                if (node.picks.size === 0) {
                    node.keepAll = true;
                }
            }
        }

        if (redactor) {
            return (input) => project(root, redactor(input)) as T;
        }

        return (input) => project(root, input) as T;
    }
}
