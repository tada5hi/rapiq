# Changelog

## [2.0.0](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.20...adapter-prisma-v2.0.0) (2026-08-11)


### Miscellaneous Chores

* release 2.0.0 ([f71d633](https://github.com/tada5hi/rapiq/commit/f71d633c43031d9f1b6134ebe5775c74ad8b59f3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0

## [2.0.0-beta.20](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.19...adapter-prisma-v2.0.0-beta.20) (2026-08-10)


### Miscellaneous Chores

* **adapter-prisma:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20

## [2.0.0-beta.19](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.18...adapter-prisma-v2.0.0-beta.19) (2026-08-07)


### ⚠ BREAKING CHANGES

* **core:** `Filters.merge()` and `mergeQueries()` compose filters as an ordered logical AND. Same-field conditions are no longer replaced by the receiver, they are retained as conjuncts, so two `eq` conditions on one field now select nothing instead of the receiver's value. Replace transient UI state before building the query, or select the current `IFilters` node and pass only that to `defineQuery`.

### Bug Fixes

* **core:** make query filter merges conjunctive ([#890](https://github.com/tada5hi/rapiq/issues/890)) ([489c9c0](https://github.com/tada5hi/rapiq/commit/489c9c0e4f99b8fc1465418b01fb48f52e96de81))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19

## [2.0.0-beta.18](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.17...adapter-prisma-v2.0.0-beta.18) (2026-08-06)


### Miscellaneous Chores

* **adapter-prisma:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18

## [2.0.0-beta.17](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.16...adapter-prisma-v2.0.0-beta.17) (2026-08-05)


### ⚠ BREAKING CHANGES

* a key path containing a `__proto__`, `constructor` or `prototype` segment now raises a typed ParseError instead of being accepted.

### Bug Fixes

* close the pre-GA release blockers ([#883](https://github.com/tada5hi/rapiq/issues/883)) ([e652be7](https://github.com/tada5hi/rapiq/commit/e652be70385495e7c287375074f6227e305e4094))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17

## [2.0.0-beta.16](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.15...adapter-prisma-v2.0.0-beta.16) (2026-08-04)


### Miscellaneous Chores

* **adapter-prisma:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16

## [2.0.0-beta.15](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.14...adapter-prisma-v2.0.0-beta.15) (2026-08-03)


### ⚠ BREAKING CHANGES

* and()/or() on an empty receiver wrap the injected conditions in a nested group instead of adopting them directly; a replace-merge against such a tree now throws FILTERS_NOT_FLAT.

### Bug Fixes

* close the pre-GA audit gaps in code and docs ([#871](https://github.com/tada5hi/rapiq/issues/871)) ([72923b0](https://github.com/tada5hi/rapiq/commit/72923b08aa8050a4c5a425d2b891d1f84fc67083))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15

## [2.0.0-beta.14](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.13...adapter-prisma-v2.0.0-beta.14) (2026-08-02)


### Bug Fixes

* **adapters:** cross-backend drift fixes from the architecture audit ([#865](https://github.com/tada5hi/rapiq/issues/865)) ([d54c80f](https://github.com/tada5hi/rapiq/commit/d54c80f52e6f7996e18e9666c85f67cb50986792))
* **deps:** bump the minorandpatch group across 1 directory with 6 updates ([#864](https://github.com/tada5hi/rapiq/issues/864)) ([4c37203](https://github.com/tada5hi/rapiq/commit/4c372030c5031388f322f56a2ac7982cb7cbe2a7))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14

## [2.0.0-beta.13](https://github.com/tada5hi/rapiq/compare/adapter-prisma-v2.0.0-beta.12...adapter-prisma-v2.0.0-beta.13) (2026-07-28)


### ⚠ BREAKING CHANGES

* @rapiq/sql, @rapiq/typeorm, @rapiq/prisma and @rapiq/memory are now published as @rapiq/adapter-sql, @rapiq/adapter-typeorm, @rapiq/adapter-prisma and @rapiq/adapter-memory.

### Code Refactoring

* prefix backend packages with adapter- ([#858](https://github.com/tada5hi/rapiq/issues/858)) ([1f43ad4](https://github.com/tada5hi/rapiq/commit/1f43ad4b52dcea413e2004d8d17d4a09afcd2d02))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13

## [2.0.0-beta.12](https://github.com/tada5hi/rapiq/compare/prisma-v2.0.0-beta.11...prisma-v2.0.0-beta.12) (2026-07-28)


### Miscellaneous Chores

* **prisma:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12

## [2.0.0-beta.11](https://github.com/tada5hi/rapiq/compare/prisma-v2.0.0-beta.10...prisma-v2.0.0-beta.11) (2026-07-27)


### Bug Fixes

* narrow an included relation to its per-relation fieldset ([#847](https://github.com/tada5hi/rapiq/issues/847)) ([#850](https://github.com/tada5hi/rapiq/issues/850)) ([bc6acef](https://github.com/tada5hi/rapiq/commit/bc6acefdb855a24af68d142e9e14010825794ca4))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11

## [2.0.0-beta.10](https://github.com/tada5hi/rapiq/compare/prisma-v2.0.0-beta.9...prisma-v2.0.0-beta.10) (2026-07-26)


### Features

* **prisma:** add prisma adapter ([#838](https://github.com/tada5hi/rapiq/issues/838)) ([83c9c94](https://github.com/tada5hi/rapiq/commit/83c9c94db1d178b17798c9b106f99cdf027cfb65))
* **prisma:** derive schemas from a datamodel ([#841](https://github.com/tada5hi/rapiq/issues/841)) ([#845](https://github.com/tada5hi/rapiq/issues/845)) ([1f8cad8](https://github.com/tada5hi/rapiq/commit/1f8cad87173246848214306ac2a3c05b4b0cf143))
* **prisma:** prefer the public $datamodel/$provider client surface ([78ce6c8](https://github.com/tada5hi/rapiq/commit/78ce6c807674b1c176e0ccfc231738beb1988df1))
* **prisma:** run queries through the bound model and merge args ([#846](https://github.com/tada5hi/rapiq/issues/846)) ([5d1e3de](https://github.com/tada5hi/rapiq/commit/5d1e3deaec20e2a5bb7a33f3f07e6e19652fcc44))


### Bug Fixes

* **prisma:** reject malformed datamodels typed ([5fb613a](https://github.com/tada5hi/rapiq/commit/5fb613a69576351fe5c4273be2ee8994b41d95cd))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
