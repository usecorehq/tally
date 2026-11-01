import { buildConfig } from "./configuration";

describe("buildConfig corsOrigins", () => {
  it("splits the comma list so each origin is matched on its own", () => {
    expect(buildConfig({ CORS_ORIGINS: "https://a.example, https://b.example,," } as NodeJS.ProcessEnv).corsOrigins).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("is empty when unset", () => {
    expect(buildConfig({} as NodeJS.ProcessEnv).corsOrigins).toEqual([]);
  });
});
