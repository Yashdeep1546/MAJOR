import ts from "typescript-eslint";

export default ts.config(
  ...ts.configs.recommended,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/graphify-out/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    }
  }
);
