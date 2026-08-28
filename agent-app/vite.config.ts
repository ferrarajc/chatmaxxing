import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/chatmaxxing/agent/',
  server: {
    // Amazon Connect will only embed the CCP on an origin in the instance's approved
    // list (5173, 5174, and the github.io site). Vite's default behaviour is to walk
    // upward when a port is busy, so a stale dev server silently pushes you to 5178 --
    // an origin Connect refuses. The iframe then never authenticates, connect.agent()
    // never fires, and the login overlay hangs forever with no error shown anywhere.
    // strictPort turns that into an immediate "port in use" instead of a dead end.
    port: 5173,
    strictPort: true,
  },
})
