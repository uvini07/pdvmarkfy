import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Gera dist/sw.js com a lista de TODOS os arquivos do build (HTML, CSS, JS,
// fontes, fotos) e uma versão tirada do conteúdo deles. Assim o PDV instalado
// abre sem internet e cada versão é guardada inteira, sem misturar CSS velho
// com HTML novo.
function servicoOffline() {
  let pastaSaida = 'dist'
  return {
    name: 'pdv-service-worker',
    apply: 'build',
    configResolved(config) {
      pastaSaida = config.build.outDir
    },
    closeBundle() {
      const arquivos = []
      const andar = (pasta) => {
        for (const item of readdirSync(pasta, { withFileTypes: true })) {
          const caminho = join(pasta, item.name)
          if (item.isDirectory()) andar(caminho)
          else arquivos.push(caminho)
        }
      }
      andar(pastaSaida)

      const modelo = readFileSync(fileURLToPath(new URL('./src/pwa/sw-modelo.js', import.meta.url)), 'utf8')
      const hash = createHash('sha256').update(modelo)
      const urls = []
      for (const arquivo of arquivos.sort()) {
        const url = '/' + relative(pastaSaida, arquivo).split(sep).join('/')
        if (url === '/sw.js') continue
        hash.update(url).update(readFileSync(arquivo))
        urls.push(url)
      }

      const sw = modelo
        .replace('__VERSAO__', hash.digest('hex').slice(0, 12))
        .replace('__ARQUIVOS__', JSON.stringify(urls, null, 2))
      writeFileSync(join(pastaSaida, 'sw.js'), sw)
    },
  }
}

export default defineConfig({
  plugins: [react(), servicoOffline()],
  build: {
    target: 'es2022',
    sourcemap: false,
    rolldownOptions: {
      output: {
        // O React vai num arquivo à parte: muda pouco entre as versões do PDV,
        // então o navegador continua com ele em cache quando o PDV é atualizado.
        codeSplitting: { groups: [{ name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ }] },
      },
    },
  },
})
