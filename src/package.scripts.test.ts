import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("Package.json Scripts - Characterization Tests", () => {
  const packageJsonPath = "./package.json";
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  describe("Development Scripts", () => {
    it("characterize: defines dev script that runs vite", () => {
      expect(packageJson.scripts.dev).toBe("vite");
    });

    it("characterize: defines build script that runs vite build", () => {
      expect(packageJson.scripts.build).toBe("vite build");
    });

    it("characterize: defines build:dev script with development mode", () => {
      expect(packageJson.scripts["build:dev"]).toBe("vite build --mode development");
    });
  });

  describe("Testing Scripts", () => {
    it("characterize: defines test script that runs vitest run", () => {
      expect(packageJson.scripts.test).toBe("vitest run");
    });

    it("characterize: defines test:watch script that runs vitest in watch mode", () => {
      expect(packageJson.scripts["test:watch"]).toBe("vitest");
    });
  });

  describe("Linting Scripts", () => {
    it("characterize: defines lint script that runs eslint on current directory", () => {
      expect(packageJson.scripts.lint).toBe("eslint .");
    });
  });

  describe("Preview Scripts", () => {
    it("characterize: defines preview script that runs vite preview", () => {
      expect(packageJson.scripts.preview).toBe("vite preview");
    });
  });

  describe("GitHub Pages Build Script", () => {
    it("characterize: defines build:gh script for GitHub Pages", () => {
      expect(packageJson.scripts["build:gh"]).toBe("vite build --base=/");
    });

    it("characterize: build:gh script uses --base=/ flag for GitHub Pages", () => {
      expect(packageJson.scripts["build:gh"]).toContain("--base=/");
    });
  });

  describe("Dependencies", () => {
    it("characterize: includes react-dom as dependency", () => {
      expect(packageJson.dependencies).toHaveProperty("react-dom");
    });

    it("characterize: includes react-router-dom as dependency", () => {
      expect(packageJson.dependencies).toHaveProperty("react-router-dom");
    });

    it("characterize: includes @supabase/supabase-js as dependency", () => {
      expect(packageJson.dependencies).toHaveProperty("@supabase/supabase-js");
    });

    it("characterize: includes vite as devDependency", () => {
      expect(packageJson.devDependencies).toHaveProperty("vite");
    });

    it("characterize: includes @vitejs/plugin-react-swc as devDependency", () => {
      expect(packageJson.devDependencies).toHaveProperty("@vitejs/plugin-react-swc");
    });

    it("characterize: includes lovable-tagger as devDependency", () => {
      expect(packageJson.devDependencies).toHaveProperty("lovable-tagger");
    });
  });

  describe("Package Metadata", () => {
    it("characterize: package type is set to module", () => {
      expect(packageJson.type).toBe("module");
    });

    it("characterize: package is marked as private", () => {
      expect(packageJson.private).toBe(true);
    });

    it("characterize: uses ES modules configuration", () => {
      expect(packageJson.type).toBe("module");
    });
  });
});