/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type {
    ICondition,
    IConditionVisitor,
} from '../../../src';
import {
    FilterCompoundOperator,
    Filters,
    and,
    eq,
    isFilter,
    isFilters,
} from '../../../src';

type CustomValue = {
    scope: string,
};

interface ICustomConditionVisitor<R> {
    visitCustom(condition: CustomCondition): R;
}

class CustomCondition implements ICondition<CustomValue> {
    readonly operator = 'custom';

    readonly sealed?: boolean;

    constructor(
        readonly value: CustomValue,
        sealed?: boolean,
    ) {
        if (sealed) {
            this.sealed = true;
        }
    }

    accept<R>(visitor: ICustomConditionVisitor<R>): R;
    accept<R>(visitor: IConditionVisitor<R>): R;
    accept<R>(visitor: ICustomConditionVisitor<R> | IConditionVisitor<R>): R {
        if ('visitCustom' in visitor) {
            return visitor.visitCustom(this);
        }

        return visitor.visitCondition(this);
    }

    seal(): CustomCondition {
        return this.sealed ? this : new CustomCondition(this.value, true);
    }
}

class CollidingCondition extends CustomCondition {
    readonly field = 'not-a-built-in-leaf';

    flatten(): this {
        return this;
    }
}

describe('src/parameter/filters condition contract', () => {
    it('should dispatch abstract built-in conditions to the generic visitor', () => {
        const visitor: IConditionVisitor<string> = {
            visitCondition: condition => condition.operator,
        };
        const leaf: ICondition = eq('name', 'Peter');
        const group: ICondition = and(eq('active', true));

        expect(leaf.accept(visitor)).toBe('eq');
        expect(group.accept(visitor)).toBe('and');
    });

    it('should let a structural custom condition expose both visitor paths', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });

        expect(condition.accept({
            visitCustom: input => input.value.scope,
        })).toBe('tenant-a');
        expect(condition.accept({
            visitCondition: input => input.operator,
        })).toBe('custom');
    });

    it('should discriminate built-in kinds by dispatch rather than member names', () => {
        const condition = new CollidingCondition({ scope: 'tenant-a' });

        expect(isFilter(condition)).toBe(false);
        expect(isFilters(condition)).toBe(false);
    });

    it('should reject detached data at typed condition boundaries', () => {
        const detached = {
            operator: 'custom',
            value: { scope: 'tenant-a' },
        };

        // @ts-expect-error detached data has no visitor or sealing behavior
        const condition: ICondition = detached;
        // @ts-expect-error helpers accept live ICondition implementations
        and(detached);
        // @ts-expect-error injection accepts live ICondition implementations
        new Filters(FilterCompoundOperator.AND, []).and(detached);

        expect(condition).toBe(detached);
    });
});
