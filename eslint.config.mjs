import { defineConfig } from '@vben/eslint-config';

// backend/ 是后端仓库 admin-server 的 submodule，不参与前端检查
export default defineConfig([{ ignores: ['backend/**'] }]);
