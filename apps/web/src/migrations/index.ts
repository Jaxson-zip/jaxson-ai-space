import * as migration_20260909_051231_init from './20260909_051231_init';
import * as migration_20260928_000000_cinematic_project_fields from './20260928_000000_cinematic_project_fields';
import * as migration_20261007_000000_private_inbox_receipts from './20261007_000000_private_inbox_receipts';
import * as migration_20261022_000000_project_home_order from './20261022_000000_project_home_order';

export const migrations = [
  {
    up: migration_20260909_051231_init.up,
    down: migration_20260909_051231_init.down,
    name: '20260909_051231_init'
  },
  {
    up: migration_20260928_000000_cinematic_project_fields.up,
    down: migration_20260928_000000_cinematic_project_fields.down,
    name: '20260928_000000_cinematic_project_fields'
  },
  {
    up: migration_20261007_000000_private_inbox_receipts.up,
    down: migration_20261007_000000_private_inbox_receipts.down,
    name: '20261007_000000_private_inbox_receipts'
  },
  {
    up: migration_20261022_000000_project_home_order.up,
    down: migration_20261022_000000_project_home_order.down,
    name: '20261022_000000_project_home_order'
  },
];
