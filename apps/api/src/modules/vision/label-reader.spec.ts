import { describe, expect, it } from "@jest/globals";
import { LABEL_MODEL, labelRequest, parseLabel } from "./label-reader";

describe("labelRequest", () => {
  it("asks Muse Spark for the label with minimal reasoning and a strict schema", () => {
    const body = labelRequest(Buffer.from([0xff, 0xd8, 0xff]), "image/jpeg") as {
      model: string;
      reasoning: { effort: string };
      text: { format: { name: string; strict: boolean } };
    };
    expect(body.model).toBe(LABEL_MODEL);
    expect(body.reasoning).toEqual({ effort: "minimal" });
    expect(body.text.format).toMatchObject({ name: "product_label", strict: true });
  });
});

describe("parseLabel", () => {
  it("trims and keeps what was read", () => {
    expect(parseLabel('{"brand":" Closeup ","name":"Toothpaste","pack":"130 g"}')).toEqual({ brand: "Closeup", name: "Toothpaste", pack: "130 g" });
  });

  it("uses the brand as the name when only the brand is legible", () => {
    expect(parseLabel('{"brand":"closeup","name":"","pack":""}')).toEqual({ brand: "closeup", name: "closeup", pack: "" });
  });

  it("returns null when nothing is legible", () => {
    expect(parseLabel('{"brand":"","name":"  ","pack":"50cl"}')).toBeNull();
  });

  it("throws on malformed output", () => {
    expect(() => parseLabel('{"brand":')).toThrow();
  });
});
