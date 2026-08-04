# Changelog

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
