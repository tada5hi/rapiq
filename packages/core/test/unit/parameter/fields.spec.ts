/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import { Field, FieldOperator, Fields } from '../../../src';

function names(fields: { value: { name: string }[] }) : string[] {
    return fields.value.map((field) => field.name);
}

describe('src/parameter/fields/*.ts', () => {
    describe('without allow-list and defaults', () => {
        it('should return explicate selection as-is', () => {
            const fields = new Fields([
                new Field('id'),
                new Field('name'),
            ]);

            const output = fields.execute({ default: [], allowed: [] });
            expect(names(output)).toEqual(['id', 'name']);
        });

        it('should return include selection when no explicates given', () => {
            const fields = new Fields([
                new Field('id', FieldOperator.INCLUDE),
                new Field('name', FieldOperator.INCLUDE),
            ]);

            const output = fields.execute({ default: [], allowed: [] });
            expect(names(output)).toEqual(['id', 'name']);
        });

        it('should prefer explicates over includes', () => {
            const fields = new Fields([
                new Field('id'),
                new Field('name', FieldOperator.INCLUDE),
            ]);

            const output = fields.execute({ default: [], allowed: [] });
            expect(names(output)).toEqual(['id']);
        });

        it('should deduplicate', () => {
            const fields = new Fields([
                new Field('id'),
                new Field('id'),
            ]);

            const output = fields.execute({ default: [], allowed: [] });
            expect(names(output)).toEqual(['id']);
        });
    });

    describe('with allow-list / defaults', () => {
        it('should keep an explicate that is allowed', () => {
            const fields = new Fields([new Field('id')]);

            const output = fields.execute({ default: [], allowed: ['id', 'name', 'email'] });
            expect(names(output)).toEqual(['id']);
        });

        it('should fall back to defaults when no valid selection is given', () => {
            const fields = new Fields([]);

            const output = fields.execute({ default: ['id', 'name'], allowed: ['email'] });
            expect(names(output)).toEqual(['id', 'name']);
        });

        it('should fall back to the allowed set when defaults are empty and nothing valid is requested', () => {
            const fields = new Fields([new Field('secret')]);

            const output = fields.execute({ default: [], allowed: ['id', 'name'] });
            expect(names(output)).toEqual(['id', 'name']);
        });

        it('should extend the default selection with an allowed include', () => {
            const fields = new Fields([new Field('email', FieldOperator.INCLUDE)]);

            const output = fields.execute({ default: ['id', 'name'], allowed: ['email'] });
            expect(names(output)).toEqual(['id', 'name', 'email']);
        });

        it('should drop an include that is neither allowed nor default', () => {
            const fields = new Fields([new Field('secret', FieldOperator.INCLUDE)]);

            const output = fields.execute({ default: ['id', 'name'], allowed: ['email'] });
            expect(names(output)).toEqual(['id', 'name']);
        });

        it('should remove excluded fields from the default selection', () => {
            const fields = new Fields([new Field('email', FieldOperator.EXCLUDE)]);

            const output = fields.execute({ default: ['id', 'name', 'email'], allowed: [] });
            expect(names(output)).toEqual(['id', 'name']);
        });

        it('should keep an explicate over the defaults', () => {
            const fields = new Fields([new Field('id')]);

            const output = fields.execute({ default: ['name', 'email'], allowed: ['id'] });
            expect(names(output)).toEqual(['id']);
        });
    });
});
