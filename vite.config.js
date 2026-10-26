import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rolldownOptions: {
      output: {
        // O React e o Firebase vão em arquivos à parte: mudam pouco entre as
        // versões do PDV, então o navegador continua com eles em cache quando o
        // PDV é atualizado.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'firebase', test: /node_modules[\\/](firebase|@firebase|idb)[\\/]/ },
          ],
        },
      },
    },
  },
})
