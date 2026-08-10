/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { isFilter, isFilters } from '../../parameter';
import type { ICondition, IFilter } from '../../parameter';
import { parseKey } from '../../utils';
import { FilterCompoundOperator } from '../parameter/filters/constants';
import type {
    IndexCheckResult,
    IndexedMode,
    IndexesResolver,
} from './types';

type NodeVerdict = {
    pass: boolean,
    /**
     * The subtree guarantees index-backed narrowing on its own. An OR
     * only anchors when every branch does; a skipped (custom) condition
     * never does.
     */
    anchors: boolean,
    /**
     * Nothing checkable inside (custom conditions, empty groups): the
     * node passes vacuously and never satisfies an anchor requirement.
     */
    skipped: boolean,
    violation?: { path: string, keys: string[] },
};

function leafTarget(field: string) : { path: string, name: string } {
    const details = parseKey(field);

    return { path: details.path ?? '', name: details.name };
}

function leafAnchors(leaf: IFilter, resolve: IndexesResolver) : boolean {
    const { path, name } = leafTarget(leaf.field);
    const indexes = resolve(path);
    if (!indexes) {
        return false;
    }

    return indexes.some((index) => index[0] === name);
}

function coversGroup(keys: string[], indexes: string[][] | null) : boolean {
    if (!indexes) {
        return false;
    }

    const set = new Set(keys);

    return indexes.some((index) => {
        if (set.size > index.length) {
            return false;
        }

        for (let i = 0; i < set.size; i++) {
            if (!set.has(index[i] as string)) {
                return false;
            }
        }

        return true;
    });
}

function violationFor(leaves: IFilter[]) : { path: string, keys: string[] } {
    return { path: '', keys: leaves.map((leaf) => leaf.field) };
}

/**
 * Pool a conjunction's leaves: direct ones and those of nested AND
 * compounds. The walk deliberately ignores the preserved flag, since
 * preservation is a pruning policy and this check only analyzes: a
 * preserved residual's leaves count toward the parent group, so a
 * conjunction that jointly forms an index prefix passes cover mode
 * regardless of how validate hooks grouped it.
 */
function collectConjunction(
    children: ICondition[],
    leaves: IFilter[],
    compounds: ICondition[],
) : void {
    for (const child of children) {
        if (isFilter(child)) {
            leaves.push(child);
        } else if (
            isFilters(child) &&
            child.operator === FilterCompoundOperator.AND
        ) {
            collectConjunction(child.value, leaves, compounds);
        } else {
            compounds.push(child);
        }
    }
}

/**
 * Verdict for one conjunction: leaves grouped per relation path,
 * compound children judged recursively. Shared by AND, NOT (interior
 * conjunction) and the lone-leaf case (an AND group of one).
 */
function checkGroup(
    leaves: IFilter[],
    compounds: ICondition[],
    resolve: IndexesResolver,
    mode: IndexedMode,
) : NodeVerdict {
    if (mode === 'cover') {
        // group coverage first: cheap, and a failure short-circuits
        // the compound recursion.
        const groups = new Map<string, string[]>();
        for (const leaf of leaves) {
            const { path, name } = leafTarget(leaf.field);
            const group = groups.get(path);
            if (group) {
                group.push(name);
            } else {
                groups.set(path, [name]);
            }
        }

        for (const [path, keys] of groups) {
            if (!coversGroup(keys, resolve(path))) {
                return {
                    pass: false,
                    anchors: false,
                    skipped: false,
                    violation: { path, keys },
                };
            }
        }

        const verdicts = compounds.map((child) => checkNode(child, resolve, mode));
        const failed = verdicts.find((verdict) => !verdict.pass);
        if (failed) {
            return failed;
        }

        const checkable = leaves.length > 0 ||
            verdicts.some((verdict) => !verdict.skipped);
        if (!checkable) {
            return {
                pass: true, 
                anchors: false, 
                skipped: true, 
            };
        }

        return {
            pass: true, 
            anchors: true, 
            skipped: false, 
        };
    }

    // anchor mode: a leaf anchor settles the verdict without recursing
    // into compound conjuncts, which are residual once the group is
    // anchored.
    if (leaves.some((leaf) => leafAnchors(leaf, resolve))) {
        return {
            pass: true, 
            anchors: true, 
            skipped: false, 
        };
    }

    const verdicts = compounds.map((child) => checkNode(child, resolve, mode));
    if (verdicts.some((verdict) => verdict.anchors)) {
        return {
            pass: true, 
            anchors: true, 
            skipped: false, 
        };
    }

    const checkable = leaves.length > 0 ||
        verdicts.some((verdict) => !verdict.skipped);
    if (!checkable) {
        return {
            pass: true, 
            anchors: false, 
            skipped: true, 
        };
    }

    const failed = verdicts.find((verdict) => !verdict.pass);

    return {
        pass: false,
        anchors: false,
        skipped: false,
        violation: failed?.violation ?? violationFor(leaves),
    };
}

function checkNode(
    node: ICondition,
    resolve: IndexesResolver,
    mode: IndexedMode,
) : NodeVerdict {
    if (isFilter(node)) {
        return checkGroup([node], [], resolve, mode);
    }

    if (isFilters(node)) {
        if (node.operator === FilterCompoundOperator.OR) {
            let skipped = true;
            for (const child of node.value) {
                const verdict = checkNode(child, resolve, mode);
                if (!verdict.pass) {
                    return verdict;
                }

                skipped = skipped && verdict.skipped;
            }

            return {
                pass: true, 
                anchors: !skipped, 
                skipped, 
            };
        }

        // AND and NOT judge their interior conjunction; nested AND
        // compounds pool into one group (see collectConjunction), OR
        // children recurse as compound conjuncts.
        const leaves : IFilter[] = [];
        const compounds : ICondition[] = [];
        collectConjunction(node.value, leaves, compounds);

        return checkGroup(leaves, compounds, resolve, mode);
    }

    // Custom condition kinds only enter through server-authored
    // validate replacements: they neither anchor nor violate.
    return {
        pass: true, 
        anchors: false, 
        skipped: true, 
    };
}

/**
 * Structural index check for a filter condition tree. Operators,
 * negation semantics and case folding are deliberately out of scope:
 * the check is uniform across engines and trusts the declaration.
 */
export function checkConditionIndexed(
    condition: ICondition,
    resolve: IndexesResolver,
    mode: IndexedMode,
) : IndexCheckResult {
    const verdict = checkNode(condition, resolve, mode);
    if (verdict.pass) {
        return { ok: true };
    }

    return { ok: false, ...(verdict.violation ?? { path: '', keys: [] }) };
}

/**
 * Ordered leftmost-prefix check for a sort key list. All keys must
 * share one relation path: no single index serves cross-table
 * ordering. Directions are ignored (structural check).
 */
export function checkSortKeysIndexed(
    names: string[],
    resolve: IndexesResolver,
) : IndexCheckResult {
    if (names.length === 0) {
        return { ok: true };
    }

    const targets = names.map(leafTarget);
    const { path } = (targets[0] as { path: string });

    const violation : IndexCheckResult = {
        ok: false, 
        path, 
        keys: names, 
    };

    if (targets.some((target) => target.path !== path)) {
        return violation;
    }

    const indexes = resolve(path);
    if (!indexes) {
        return violation;
    }

    const keys = targets.map((target) => target.name);
    for (const index of indexes) {
        if (
            keys.length <= index.length &&
            keys.every((key, i) => index[i] === key)
        ) {
            return { ok: true };
        }
    }

    return violation;
}
