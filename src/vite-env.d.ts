/// <reference types="vite/client" />

/**
 * Augments the NodeJS.ProcessEnv interface to include environment variables
 * defined in the Vite configuration. This provides type-safe access
 * to `process.env` variables throughout the application.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The API key for the Google Gemini API.
     * This is injected at build time by Vite.
     */
    API_KEY: string;
  }
}
