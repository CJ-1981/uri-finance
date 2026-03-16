import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Vite Configuration - Characterization Tests", () => {
  const configPath = join(__dirname, "..", "vite.config.ts");
  let configContent: string;

  beforeEach(() => {
    configContent = readFileSync(configPath, "utf-8");
  });

  afterEach(() => {
    // Cleanup any temporary test artifacts
  });

  describe("ComponentTagger Plugin Configuration", () => {
    it("characterize: includes lovable-tagger import statement", () => {
      expect(configContent).toContain('import { componentTagger } from "lovable-tagger"');
    });

    it("characterize: includes componentTagger in plugins array for development mode", () => {
      expect(configContent).toContain('componentTagger()');
    });

    it("characterize: uses mode-based filtering for componentTagger", () => {
      expect(configContent).toContain('mode === "development"');
    });

    it("characterize: filters boolean values in plugins array", () => {
      expect(configContent).toContain('.filter(Boolean)');
    });

    it("characterize: imports React plugin from @vitejs/plugin-react-swc", () => {
      expect(configContent).toContain('@vitejs/plugin-react-swc');
    });

    it("characterize: includes path module for directory resolution", () => {
      expect(configContent).toContain('import path from "path"');
    });

    it("characterize: defines path alias for @/ pointing to ./src", () => {
      expect(configContent).toContain('"@": path.resolve(__dirname, "./src")');
    });
  });

  describe("Build Configuration", () => {
    it("characterize: uses defineConfig from vite", () => {
      expect(configContent).toContain('import { defineConfig } from "vite"');
    });

    it("characterize: configures server with host '::' and port 8080", () => {
      expect(configContent).toContain('host: "::"');
      expect(configContent).toContain('port: 8080');
    });

    it("characterize: disables HMR overlay", () => {
      expect(configContent).toContain('overlay: false');
    });

    it("characterize: defines __BUILD_TIME__ as ISO string", () => {
      expect(configContent).toContain('__BUILD_TIME__');
      expect(configContent).toContain('new Date().toISOString()');
    });

    it("characterize: config is exported as default", () => {
      expect(configContent).toContain('export default defineConfig');
    });
  });

  describe("Mode-based Configuration", () => {
    it("characterize: accepts mode parameter in defineConfig", () => {
      expect(configContent).toContain('({ mode })');
    });

    it("characterize: uses mode variable for conditional logic", () => {
      expect(configContent).toMatch(/mode === "development"/);
    });
  });

  describe("Path Resolution", () => {
    it("characterize: configures resolve.alias section", () => {
      expect(configContent).toContain('resolve:');
      expect(configContent).toContain('alias:');
    });

    it("characterize: uses path.resolve for alias definitions", () => {
      expect(configContent).toContain('path.resolve');
    });
  });

  describe("Base Path Configuration", () => {
    it("characterize: configures base path with VITE_BASE_URL environment variable", () => {
      expect(configContent).toContain('VITE_BASE_URL');
    });

    it("characterize: provides default fallback of '/' when VITE_BASE_URL is not set", () => {
      expect(configContent).toContain('process.env.VITE_BASE_URL || "/"');
    });

    it("characterize: includes base configuration in defineConfig", () => {
      expect(configContent).toContain('base:');
    });
  });
});