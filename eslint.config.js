import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import { configs as litConfigs } from 'eslint-plugin-lit'

export default tseslint.config(
    { ignores: ['dist', 'node_modules'] },
    js.configs.recommended,
    tseslint.configs.recommended,
    litConfigs['flat/recommended'],
    {
        rules: {
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        },
    },
)
