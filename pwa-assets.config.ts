import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// アイコンは public/icon.svg から生成する（npx @vite-pwa/assets-generator）
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    apple: { ...minimal2023Preset.apple, padding: 0 },
    maskable: { ...minimal2023Preset.maskable, padding: 0 },
  },
  images: ['public/icon.svg'],
})
