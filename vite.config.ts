import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: false,
      minify: 'esbuild',
      chunkSizeWarningLimit: 900,
      target: 'es2020',
      assetsInlineLimit: 4096,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React vendor chunk
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'react';
            }
            // Supabase vendor chunk
            if (id.includes('node_modules/@supabase')) {
              return 'supabase';
            }
            // Dashboard components - load together as they're typically used together
            if (id.includes('AdminDashboard') || id.includes('SupervisorDashboard') || id.includes('CustomerDashboard')) {
              return 'dashboards';
            }
            // Modal/panel components
            if (id.includes('TicketModal') || id.includes('ChatSystem')) {
              return 'modals';
            }
            // Betting terminal - usually loaded separately
            if (id.includes('BettingTerminal')) {
              return 'betting';
            }
          },
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
        external: [],
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
