/// <reference types="vite/client" />

/**
 * Augments the NodeJS.ProcessEnv interface to include custom environment variables.
 * This resolves TypeScript errors for `process.env.API_KEY` by adding it to the
 * existing type definitions provided by Node or other libraries, avoiding redeclaration conflicts.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY: string;
  }
}
