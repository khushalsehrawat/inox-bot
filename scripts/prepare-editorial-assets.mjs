import sharp from "sharp";
import { mkdir } from "node:fs/promises";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const entries = JSON.parse(input.replace(/^\uFEFF/, ""));
await mkdir("public/media/editorial", { recursive: true });
for (const { name, path } of entries) {
  await sharp(path)
    .resize({
      width: name === "editorial-kitchen" ? 1920 : 1200,
      withoutEnlargement: true,
    })
    .webp({ quality: 88 })
    .toFile(`public/media/editorial/${name}.webp`);
  console.log(name);
}
