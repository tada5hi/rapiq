/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { expectTypeOf } from 'vitest';
import type {
    ICondition,
    IConditionVisitor,
} from '../../../src';
import {
    FilterCompoundOperator,
    Filters,
    and,
    elemMatch,
    eq,
    isFilter,
    isFilters,
    not,
    or,
    seal,
} from '../../../src';

type CustomValue = {
    scope: string,
};

interface ISealedCustomCondition extends ICondition<CustomValue> {
    readonly stage: 'sealed';
    readonly sealed: true;
    seal(): ISealedCustomCondition;
}

interface IUnsealedCustomCondition extends ICondition<CustomValue> {
    readonly stage: 'unsealed';
    seal(): ISealedCustomCondition;
}

interface ICustomConditionVisitor<R> {
    visitCustom(condition: CustomCondition): R;
}

class CustomCondition implements ICondition<CustomValue> {
    readonly operator = 'custom';

    readonly field = 'not-a-built-in-leaf';

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

    flatten(): this {
        return this;
    }
}

describe('src/parameter/filters condition contract', () => {
    it('should dispatch abstract built-in conditions to the generic visitor', () => {
        const visitor: IConditionVisitor<string> = { visitCondition: (condition) => condition.operator };
        const leaf: ICondition = eq('name', 'Peter');
        const group: ICondition = and(eq('active', true));

        expect(leaf.accept(visitor)).toBe('eq');
        expect(group.accept(visitor)).toBe('and');
    });

    it('should let a structural custom condition expose both visitor paths', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });

        expect(condition.accept({ visitCustom: (input) => input.value.scope })).toBe('tenant-a');
        expect(condition.accept({ visitCondition: (input) => input.operator })).toBe('custom');
    });

    it('should discriminate built-in kinds by dispatch rather than member names', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });

        expect(isFilter(condition)).toBe(false);
        expect(isFilters(condition)).toBe(false);
    });

    it('should accept a custom condition in every composition helper', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });

        expect(and(condition).value).toEqual([condition]);
        expect(or(condition).value).toEqual([condition]);
        expect(not(condition).value).toEqual([condition]);
        expect(elemMatch('items', condition).value).toBe(condition);
    });

    it('should seal custom conditions polymorphically', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });
        const output = seal(condition);

        expectTypeOf(output).toEqualTypeOf<CustomCondition>();
        expect(output).not.toBe(condition);
        expect(output.sealed).toBe(true);
        expect(seal(output)).toBe(output);
    });

    it('should derive the helper result from the implementation seal method', () => {
        const assertReturnType = (condition: IUnsealedCustomCondition) => {
            const output = seal(condition);

            expectTypeOf(output).toEqualTypeOf<ISealedCustomCondition>();
        };

        expectTypeOf(assertReturnType).toBeFunction();
    });

    it('should seal a custom condition injected into a built-in group', () => {
        const condition = new CustomCondition({ scope: 'tenant-a' });
        const receiver = new Filters(FilterCompoundOperator.AND, [eq('name', 'Peter')]);

        const withAnd = receiver.and(condition);
        const withOr = receiver.or(condition);

        expect(withAnd.value[1]).toEqual(condition.seal());
        expect(withOr.value[1]).toEqual(condition.seal());
        expect(withAnd.value[1]).not.toBe(condition);
        expect(withOr.value[1]).not.toBe(condition);
    });

    it('should keep detached runtime data unchanged when it has no seal method', () => {
        const detached = {
            operator: 'custom',
            value: { scope: 'tenant-a' },
        };

        expect(seal(detached as unknown as ICondition)).toBe(detached);
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
