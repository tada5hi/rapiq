/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import {
    Column,
    Entity,
    ManyToMany,
    PrimaryColumn,
} from 'typeorm';
import type { ArticleEntity } from './article';

@Entity({ name: 'tag' })
export class TagEntity {
    @PrimaryColumn({ type: 'varchar' })
    id!: string;

    @Column({ type: 'varchar' })
    name!: string;

    @ManyToMany('ArticleEntity', (article: ArticleEntity) => article.tags)
    articles!: ArticleEntity[];
}
