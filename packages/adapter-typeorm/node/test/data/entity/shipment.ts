/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/* eslint-disable max-classes-per-file --
 * both ends of the to-many relation live here, as in ./activity.ts.
 */

import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryColumn,
    PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Composite primary key fixture: a grouped query correlates its
 * to-many filters on every key column. Not part of the shared entity
 * list in `../factory.ts`; specs build their own data source.
 */
@Entity()
export class Shipment {
    @PrimaryColumn({ type: 'varchar', length: 8 })
    region: string;

    @PrimaryColumn({ type: 'int' })
    code: number;

    @Column({ type: 'int', default: 0 })
    weight: number;

    @OneToMany(() => Parcel, (parcel: Parcel) => parcel.shipment)
    parcels: Parcel[];
}

@Entity()
export class Parcel {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar' })
    label: string;

    @Column({ type: 'varchar', length: 8 })
    shipment_region: string;

    @Column({ type: 'int' })
    shipment_code: number;

    @ManyToOne(() => Shipment, (shipment: Shipment) => shipment.parcels)
    @JoinColumn([
        { name: 'shipment_region', referencedColumnName: 'region' },
        { name: 'shipment_code', referencedColumnName: 'code' },
    ])
    shipment: Shipment;
}
