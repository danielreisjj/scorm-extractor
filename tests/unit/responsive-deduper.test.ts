import { describe, expect, it } from "vitest";
import { dedupeResponsiveHtml } from "../../src/infrastructure/parsers/html/responsive-deduper.js";

describe("dedupeResponsiveHtml", () => {
  it("keeps desktop copy and drops tablet/mobile duplicates", () => {
    const html = `
      <div class="box desktop-only"><p>Considerações finais</p></div>
      <div class="box tablet-only"><p>Considerações finais</p></div>
      <div class="box mobile-only"><p>Considerações finais</p></div>
    `;
    const out = dedupeResponsiveHtml(html);
    expect(out.match(/Considerações finais/g)).toHaveLength(1);
    expect(out).toContain("desktop-only");
    expect(out).not.toContain("tablet-only");
    expect(out).not.toContain("mobile-only");
  });

  it("keeps a mobile-only block when it has no duplicate", () => {
    const html = `<div class="mobile-only"><p>Só no celular</p></div>`;
    const out = dedupeResponsiveHtml(html);
    expect(out).toContain("Só no celular");
  });
});
