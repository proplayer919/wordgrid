// This patch is a workaround for a known issue in Bun where the `v8` module's `startupSnapshot` property is not correctly set when running in certain environments. The patch overrides the `getBuiltinModule` function to ensure that the `isBuildingSnapshot` method returns `false`, preventing potential issues with snapshot building.

import nodeV8 from 'node:v8';

if (globalThis.process?.getBuiltinModule) {
  const originalGetBuiltin = globalThis.process.getBuiltinModule;

  globalThis.process.getBuiltinModule = function (moduleName: string) {
    const mod = originalGetBuiltin.call(this, moduleName) as any;
    if (moduleName === 'v8' && mod?.startupSnapshot) {
      mod.startupSnapshot.isBuildingSnapshot = () => false;
    }
    return mod;
  };
}
