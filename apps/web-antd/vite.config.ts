import process from 'node:process';

import { defineConfig } from '@vben/vite-config';

import { loadEnv } from 'vite';

export default defineConfig(async ({ mode }) => {
  // 开发时浏览器请求 VITE_GLOB_API_URL 开头的接口，由 vite 去掉这个前缀后转发到后端 API_PROXY_TARGET
  const env = loadEnv(mode, process.cwd(), '');
  const prefix = env.VITE_GLOB_API_URL || '/api';
  const target = env.API_PROXY_TARGET || 'http://localhost:9050';

  return {
    application: {},
    vite: {
      // monorepo 里 vue-router 因依赖解析不同装了两份，生产打包时布局包会用到另一份，
      // useRouter() 取不到应用注册的路由导致白屏；强制只用一份
      resolve: {
        dedupe: ['vue', 'vue-router', 'pinia'],
      },
      server: {
        proxy: {
          [prefix]: {
            changeOrigin: true,
            rewrite: (path) => path.slice(prefix.length),
            target,
          },
        },
      },
    },
  };
});
