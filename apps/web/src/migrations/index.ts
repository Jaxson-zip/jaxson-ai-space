import * as migration_20260909_051231_init from './20260909_051231_init';

export const migrations = [
  {
    up: migration_20260909_051231_init.up,
    down: migration_20260909_051231_init.down,
    name: '20260909_051231_init'
  },
];
