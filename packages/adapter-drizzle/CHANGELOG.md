# Changelog

## [2.0.0](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.20...adapter-drizzle-v2.0.0) (2026-08-11)


### Miscellaneous Chores

* release 2.0.0 ([f71d633](https://github.com/tada5hi/rapiq/commit/f71d633c43031d9f1b6134ebe5775c74ad8b59f3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0

## [2.0.0-beta.20](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.19...adapter-drizzle-v2.0.0-beta.20) (2026-08-10)


### Miscellaneous Chores

* **adapter-drizzle:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20

## [2.0.0-beta.19](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.18...adapter-drizzle-v2.0.0-beta.19) (2026-08-07)


### Miscellaneous Chores

* **adapter-drizzle:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19

## [2.0.0-beta.18](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.17...adapter-drizzle-v2.0.0-beta.18) (2026-08-06)


### Miscellaneous Chores

* **adapter-drizzle:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18

## [2.0.0-beta.17](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.16...adapter-drizzle-v2.0.0-beta.17) (2026-08-05)


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

## [2.0.0-beta.16](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.15...adapter-drizzle-v2.0.0-beta.16) (2026-08-04)


### Miscellaneous Chores

* **adapter-drizzle:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16

## [2.0.0-beta.15](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.14...adapter-drizzle-v2.0.0-beta.15) (2026-08-03)


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

## [2.0.0-beta.14](https://github.com/tada5hi/rapiq/compare/adapter-drizzle-v2.0.0-beta.13...adapter-drizzle-v2.0.0-beta.14) (2026-08-02)


### Features

* add drizzle adapter (@rapiq/adapter-drizzle) ([#862](https://github.com/tada5hi/rapiq/issues/862)) ([c0db671](https://github.com/tada5hi/rapiq/commit/c0db67159d0dad41d952e6b08fa5d493c651c5fe))


### Bug Fixes

* **adapters:** cross-backend drift fixes from the architecture audit ([#865](https://github.com/tada5hi/rapiq/issues/865)) ([d54c80f](https://github.com/tada5hi/rapiq/commit/d54c80f52e6f7996e18e9666c85f67cb50986792))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
