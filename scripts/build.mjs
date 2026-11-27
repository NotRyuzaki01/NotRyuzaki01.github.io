import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
// Keep the export aligned with the directly served GitHub Pages source.
const publicEntries = ["index.html", "card", "assets", "artem-kotliar.vcf", "CNAME"];

await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const entry of publicEntries) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output), { recursive: true });
}
console.log("Static export written to dist/");
