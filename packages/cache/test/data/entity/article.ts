/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column,
    Entity,
    JoinTable,
    ManyToMany,
    PrimaryColumn,
} from 'typeorm';
import { TagEntity } from './tag';

/**
 * The owning side of a many-to-many relation: linking and unlinking a tag
 * writes the junction table alone, and fires hooks on its metadata only.
 */
@Entity({ name: 'article' })
export class ArticleEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({ type: 'varchar' })
    title!: string;

    @ManyToMany(() => TagEntity, (tag) => tag.articles)
    @JoinTable({ name: 'article_tag' })
    tags!: TagEntity[];
}
