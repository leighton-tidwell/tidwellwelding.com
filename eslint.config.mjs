import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
    // Machine-generated Convex client code.
    "convex/_generated/**",
  ]),
  {
    rules: {
      // next.config images.unoptimized is set; design markup uses plain <img>/<video>.
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Test files only: allow underscore-prefixed placeholders (mock
    // constructor params) and `const { x: _omit, ...rest }` rest-sibling
    // destructuring. App rules stay untouched.
    files: ["**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
