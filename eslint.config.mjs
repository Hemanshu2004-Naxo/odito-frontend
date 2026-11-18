import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15.1.x ships a LEGACY (eslintrc) config: ESLint 9's flat config cannot take it directly (that is what failed with
// 'Plugin "" not found'). FlatCompat is the documented bridge: it turns "next/core-web-vitals" into flat config objects.
const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // ESLint 9 lints only .js/.mjs/.cjs unless told otherwise: the app is mostly .jsx
  { files: ["**/*.{js,jsx,mjs,cjs}"] },
  ...compat.extends("next/core-web-vitals"),
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"] },
];

export default eslintConfig;
