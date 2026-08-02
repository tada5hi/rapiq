# Changelog

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
