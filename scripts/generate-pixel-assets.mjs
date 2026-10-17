import { mkdir, writeFile } from "node:fs/promises";
const dir = "apps/web/public/assets/e2";
await mkdir(dir, { recursive: true });
const catalog = [];
const rect = (x, y, w, h, c) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
const line = (x, y, w, h, c = "#adc9ac") => rect(x, y, w, h, c);
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 3}" height="${h * 3}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${body}</svg>`;
async function save(name, w, h, body, category) {
  await writeFile(`${dir}/${name}.svg`, svg(w, h, body));
  catalog.push({
    id: name,
    path: `/assets/e2/${name}.svg`,
    width: w,
    height: h,
    displayWidth: w * 3,
    displayHeight: h * 3,
    version: 2,
    category,
    source:
      "Arte vetorial procedural original do projeto; sem arquivos externos.",
  });
}
function pitch(x, y, w, h) {
  let b = "";
  for (let i = 0; i < 8; i++)
    b += rect(x + (i * w) / 8, y, w / 8, h, i % 2 ? "#32734a" : "#2a6242");
  b += `<path d="M${x + 4} ${y + 4}h${w - 8}v${h - 8}h-${w - 8}ZM${x + w / 2} ${y + 4}v${h - 8}" fill="none" stroke="#8daf85" stroke-width="1"/>`;
  return b;
}
function person(x, y, c = "#d4b67d", shirt = "#b7ce64") {
  return (
    rect(x + 2, y, 4, 4, c) +
    rect(x, y + 4, 8, 7, shirt) +
    rect(x + 1, y + 11, 2, 4, "#17263b") +
    rect(x + 5, y + 11, 2, 4, "#17263b")
  );
}
function building(x, y, w, h, c) {
  return (
    rect(x - 3, y - 3, w + 6, 4, "#102633") +
    rect(x, y, w, h, c) +
    rect(x + 5, y + 5, w - 10, 3, "#a9bc96") +
    Array.from({ length: Math.floor(w / 16) }, (_, i) =>
      rect(x + 5 + i * 16, y + 13, 8, 12, "#142e41"),
    ).join("")
  );
}
let b = rect(0, 0, 480, 272, "#122637");
for (let side = 0; side < 2; side++)
  for (let row = 0; row < 5; row++)
    for (let i = 0; i < 58; i++)
      b += rect(
        9 + i * 8,
        5 + row * 5 + side * 238,
        4,
        3,
        ["#4b7381", "#79958d", "#a8b89a", "#71805c"][(i * 3 + row) % 4],
      );
b += rect(5, 31, 470, 7, "#a1b86d") + rect(5, 235, 470, 7, "#b3bd8d");
b += pitch(27, 43, 426, 185);
for (const x of [2, 465]) {
  b += rect(x, 44, 12, 185, "#344b57");
  for (let y = 50; y < 220; y += 12) b += rect(x + 3, y, 5, 5, "#71928b");
}
for (const x of [15, 438])
  b += rect(x, 1, 2, 28, "#a0aca0") + rect(x - 5, 1, 15, 5, "#d9d9b0");
await save("environment-stadium", 480, 272, b, "environment");
for (const kind of [
  "locker",
  "training",
  "scout",
  "market",
  "depot",
  "league",
]) {
  let q = rect(0, 0, 320, 112, "#112d3d") + rect(0, 84, 320, 28, "#2e4147");
  for (let i = 0; i < 320; i += 16) q += line(i, 84, 1, 28, "#354e53");
  if (kind === "locker") {
    for (let i = 0; i < 7; i++) {
      const x = 12 + i * 43;
      q +=
        rect(x, 13, 35, 65, "#375c68") +
        rect(x + 2, 15, 31, 3, "#728e88") +
        rect(x + 16, 25, 2, 8, "#b7b38b") +
        rect(x + 8, 35, 18, 24, i % 2 ? "#e4c178" : "#9db96a") +
        rect(x + 13, 35, 7, 4, "#1a3b43");
    }
    q +=
      rect(9, 80, 300, 7, "#a4825a") +
      rect(18, 87, 4, 19, "#3f332e") +
      rect(293, 87, 4, 19, "#3f332e");
  } else if (kind === "training") {
    q =
      rect(0, 0, 320, 112, "#9dbba0") +
      rect(0, 20, 320, 17, "#456e58") +
      pitch(0, 37, 210, 75) +
      building(220, 29, 93, 65, "#3d5564");
    for (let i = 0; i < 7; i++)
      q +=
        rect(13 + i * 25, 67 + (i % 2) * 20, 5, 5, "#df9358") +
        rect(11 + i * 25, 72 + (i % 2) * 20, 9, 2, "#e9b366");
    q +=
      person(60, 48) +
      person(130, 78, "#8e6048", "#d4c188") +
      rect(238, 79, 52, 3, "#8e9996") +
      rect(233, 70, 5, 18, "#142734") +
      rect(290, 70, 5, 18, "#142734");
  } else if (kind === "scout") {
    q += rect(12, 11, 100, 58, "#8c7956") + rect(17, 16, 90, 48, "#d6ca9e");
    for (let i = 0; i < 5; i++)
      q += rect(
        22 + i * 15,
        22 + (i % 2) * 8,
        11,
        15,
        ["#8aa17d", "#809fa0", "#b8a572"][i % 3],
      );
    q +=
      rect(140, 22, 65, 35, "#486b70") +
      rect(145, 27, 55, 25, "#b8d0bc") +
      rect(135, 76, 140, 8, "#a78459") +
      rect(146, 84, 6, 28, "#614e3b") +
      rect(259, 84, 6, 28, "#614e3b") +
      rect(200, 55, 35, 19, "#142b3b") +
      rect(203, 58, 29, 13, "#739788") +
      person(174, 54, "#ba8d69", "#345b5d") +
      rect(156, 71, 20, 4, "#e6d8aa");
  } else if (kind === "market") {
    q =
      rect(0, 0, 320, 112, "#71978b") +
      rect(0, 70, 320, 42, "#465a5e") +
      building(50, 20, 220, 65, "#3d5d66") +
      rect(75, 28, 170, 10, "#c7bb86") +
      rect(151, 50, 23, 35, "#172c3e");
    for (let i = 0; i < 4; i++)
      q += person(
        80 + i * 46,
        80,
        ["#d1a480", "#8b674f"][i % 2],
        ["#b5c57c", "#82abc2"][i % 2],
      );
    q += rect(21, 53, 13, 32, "#3b6948") + rect(18, 43, 20, 21, "#54855a");
  } else if (kind === "depot") {
    for (let row = 0; row < 2; row++) {
      q += rect(9, 37 + row * 37, 301, 4, "#899184");
      for (let i = 0; i < 7; i++) {
        let x = 15 + i * 42,
          y = 15 + row * 37;
        q +=
          rect(x, y, 28, 22, "#a17d52") +
          rect(x + 3, y + 3, 22, 3, "#c0a16a") +
          rect(x + 11, y + 2, 5, 20, "#c5b37c") +
          rect(x + 9, y + 8, 9, 8, "#355560");
      }
    }
    q += rect(8, 8, 3, 98, "#5a6e72") + rect(307, 8, 3, 98, "#5a6e72");
  } else {
    for (let i = 0; i < 6; i++)
      q +=
        rect(12 + i * 52, 5, 35, 45, ["#699473", "#769bb1", "#b1a671"][i % 3]) +
        rect(25 + i * 52, 13, 9, 12, "#d5c188");
    q +=
      rect(95, 91, 130, 21, "#5b645e") +
      rect(126, 76, 68, 36, "#7f866e") +
      rect(152, 36, 16, 28, "#dcc67e") +
      rect(145, 36, 30, 7, "#e9d69a") +
      rect(146, 43, 5, 12, "#c3a760") +
      rect(170, 43, 5, 12, "#c3a760") +
      rect(158, 62, 4, 11, "#d7c080") +
      rect(147, 73, 26, 4, "#d7c080");
  }
  await save(`environment-${kind}`, 320, 112, q, "environment");
}
const names = [
  "varzea",
  "regional",
  "estadual",
  "nacional",
  "continental",
  "europa",
  "elite",
];
for (let i = 0; i < 7; i++) {
  let q =
    rect(
      0,
      0,
      320,
      112,
      [
        "#b4c4a1",
        "#9ebcba",
        "#99b4c9",
        "#91a2ba",
        "#c2b19b",
        "#b4bdc5",
        "#9d99b5",
      ][i],
    ) + rect(0, 60, 320, 52, "#396647");
  for (let n = 0; n < 8; n++)
    q += building(
      n * 46 - 10,
      42 - i * 3 - (n % 3) * 8,
      34,
      25 + i * 3,
      "#456474",
    );
  q +=
    pitch(45, 58, 230, 48) +
    rect(
      35,
      51,
      250,
      5,
      [
        "#81996a",
        "#729e9c",
        "#85a8b4",
        "#9da3b5",
        "#b09a82",
        "#a5b2c4",
        "#d2bd85",
      ][i],
    );
  for (let j = 0; j < i + 1; j++) q += rect(43, 45 - j * 4, 233, 3, "#405967");
  if (i === 0) {
    q +=
      rect(10, 45, 4, 50, "#604c38") +
      rect(1, 20, 28, 33, "#50774a") +
      rect(285, 42, 3, 55, "#a9b59a");
  }
  if (i >= 4)
    for (const x of [20, 293])
      q += rect(x, 10, 2, 50, "#ced3c5") + rect(x - 6, 9, 16, 5, "#e5deb5");
  await save(`region-${names[i]}`, 320, 112, q, "region");
}
b =
  rect(4, 8, 24, 21, "#a27b48") +
  rect(3, 7, 26, 4, "#d0ac70") +
  rect(6, 12, 20, 3, "#785638") +
  rect(14, 7, 4, 22, "#d8c28d") +
  rect(9, 16, 12, 8, "#244d58") +
  rect(13, 17, 4, 5, "#c5dc9f");
await save("item-common-supply", 32, 32, b, "item");
await writeFile(
  `${dir}/catalog.json`,
  JSON.stringify(
    {
      version: "E2.1",
      license: "Original project artwork",
      rendering:
        "SVG crispEdges; integer coordinates; 3× nominal export, scalable; no bitmap duplication",
      assets: catalog,
    },
    null,
    2,
  ),
);
console.log(`${catalog.length} assets originais criados.`);
