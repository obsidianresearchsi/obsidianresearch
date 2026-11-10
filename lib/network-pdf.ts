import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { deviceLabel, ENVIRONMENTS, estimateNetwork, networkNaira, simulateNetwork, type NetworkPlan, type NetworkPrices } from "./network";
import { fitPdfText, quoteDate, quoteHeader, quoteLogo, QUOTE_NAVY, QUOTE_SIZE } from "./quote-pdf";
import type { StudioEquipment } from "./studio-equipment";

const A4 = QUOTE_SIZE;
const navy = QUOTE_NAVY;
const ink = rgb(.12, .2, .31);
const muted = rgb(.32, .39, .47);
const teal = rgb(.18, .57, .57);
const paper = rgb(.94, .97, .99);
const white = rgb(1, 1, 1);
const left = 37;
const right = A4[0] - left;

export async function createNetworkPdf(plan: NetworkPlan, prices: NetworkPrices, equipment: StudioEquipment[] = [], logoBytes?: Uint8Array) {
  const doc = await PDFDocument.create();
  doc.setTitle("Obsidian Research - Network design and budget");
  doc.setAuthor("Obsidian Research");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await quoteLogo(doc,logoBytes);
  const quote = estimateNetwork(plan, prices, equipment);
  const simulation = simulateNetwork(plan);
  const page = doc.addPage(A4);
  const print = (text: string, x: number, y: number, size = 10, strong = false, color = ink) =>
    page.drawText(text, { x, y, size, font: strong ? bold : regular, color });
  const rightAlign = (text: string, x: number, y: number, size = 10, strong = false, color = ink) =>
    print(text, x - (strong ? bold : regular).widthOfTextAtSize(text, size), y, size, strong, color);

  quoteHeader(page,logo,bold,"Network design & budget",`Prepared ${quoteDate()}  |  Planning estimate in NGN`);

  print("Equipment and services", left, 695, 14, true);
  page.drawRectangle({ x: left, y: 666, width: right - left, height: 20, color: paper });
  print("Item", left + 7, 673, 9, true);
  rightAlign("Qty", 334, 673, 9, true);
  rightAlign("Unit cost", 440, 673, 9, true);
  rightAlign("Line total", right - 8, 673, 9, true);
  let y = 652;
  const mainParts = quote.parts.slice(0,10);
  const extraParts = quote.parts.slice(10);
  for (const part of mainParts) {
    print(fitPdfText(part.label,regular,9,255), left + 7, y, 9);
    rightAlign(`${part.quantity}${part.key === "cable" ? " m" : ""}`, 334, y, 9);
    rightAlign(part.price === null ? "-" : networkNaira(part.price), 440, y, 9);
    rightAlign(part.total === null ? "Quote required" : networkNaira(part.total), right - 8, y, 9, true);
    page.drawLine({ start: { x: left, y: y - 5 }, end: { x: right, y: y - 5 }, thickness: .45, color: paper });
    y -= 16;
  }
  y -= 12;
  page.drawRectangle({ x: left, y: y - 9, width: right - left, height: 26, color: navy });
  print(quote.pending ? "Priced subtotal" : "Budget estimate", left + 8, y, 11, true, white);
  rightAlign(`NGN ${networkNaira(quote.subtotal)}`, right - 8, y, 12, true, white);
  const quoteNote = extraParts.length ? "The subtotal includes items on the equipment schedule. Subscription is separate."
    : "Subscription and extra equipment are separate.";
  print(`${quote.pending ? `${quote.pending} items require pricing. ` : ""}${quoteNote}`, left, y - 26, 9, false, muted);
  print("Site layout", left, y - 51, 14, true);
  print(`${plan.site} x ${plan.site} m  |  ${ENVIRONMENTS[plan.environment]}  |  ${plan.voucher ? "Voucher portal requested" : "Voucher portal off"}`,
    left, y - 66, 9, false, muted);

  const mapSize = 178;
  const mapBottom = y - 76 - mapSize;
  const position = (x: number, y: number) => ({ x: left + x * mapSize / 100, y: mapBottom + (100 - y) * mapSize / 100 });
  page.drawRectangle({ x: left, y: mapBottom, width: mapSize, height: mapSize, color: paper, borderColor: teal, borderWidth: .7 });
  const nodes = new Map(plan.devices.map((device) => [device.id, device]));
  for (const { link, warning } of simulation.links) {
    const from = nodes.get(link.from)!;
    const to = nodes.get(link.to)!;
    page.drawLine({ start: position(from.x, from.y), end: position(to.x, to.y), thickness: 1.2,
      color: warning ? rgb(.68, .27, .18) : simulation.routes.has(to.id) ? teal : muted, dashArray: link.kind === "bridge" ? [4, 3] : undefined });
  }
  plan.devices.forEach((device, index) => {
    const point = position(device.x, device.y);
    const number = String(device.id);
    page.drawCircle({ ...point, size: Math.max(5, 2 + bold.widthOfTextAtSize(number, 6) / 2), color: simulation.routes.has(device.id) ? navy : muted });
    print(number, point.x - bold.widthOfTextAtSize(number, 6) / 2, point.y - 2, 6, true, white);
    print(fitPdfText(deviceLabel(device,equipment),regular,8.5,145), left + mapSize + 16 + (index >= 8 ? 154 : 0), mapBottom + mapSize - 9 - (index % 8) * 15, 8.5);
  });
  print("Site layout is schematic. Dashed lines represent wireless bridges.", left, mapBottom - 14, 8.5, false, muted);
  print("Confirm measured coverage, clearances, compatibility and pricing with Obsidian Research.", left, 34, 9, true);

  function linkDescription({ link, metres, warning }: (typeof simulation.links)[number]) {
    const name = `${deviceLabel(nodes.get(link.from)!,equipment)} to ${deviceLabel(nodes.get(link.to)!,equipment)}`;
    const distance = link.kind === "bridge" ? `LiteBeam pair / ${link.km} km` : `Ethernet / ${metres} m`;
    return { name, status: `${distance}  |  ${warning ?? (simulation.routes.has(link.to) ? "Reachable in simulation" : "No upstream traffic")}` };
  }

  if (extraParts.length) {
    const schedule = doc.addPage(A4);
    quoteHeader(schedule,logo,bold,"Equipment schedule","Additional items included in the quoted subtotal");
    extraParts.forEach((part,index) => {
      const row=690-index*29;
      schedule.drawText(fitPdfText(`${part.quantity} x ${part.label}`,bold,10,357),{ x:left,y:row,font:bold,size:10,color:ink });
      schedule.drawText(part.total===null ? "Quote required" : `NGN ${networkNaira(part.total)}`,{x:430,y:row,font:regular,size:9,color:ink});
    });
  }
  if (simulation.links.length > 5) {
    const detail = doc.addPage(A4);
    quoteHeader(detail,logo,bold,"Connection schedule","Network Studio / topology and reachability");
    let row = 695;
    for (const connection of simulation.links) {
      const { name, status } = linkDescription(connection);
      detail.drawText(fitPdfText(name,bold,11,right-left), { x: left, y: row, font: bold, size: 11, color: ink });
      detail.drawText(status, { x: left, y: row - 14, font: regular, size: 9, color: muted });
      row -= 39;
    }
  } else if (simulation.links.length) {
    print("Connection schedule", left, mapBottom - 39, 13, true);
    simulation.links.forEach((connection, index) => {
      const { name, status } = linkDescription(connection);
      const row = mapBottom - 57 - index * 23;
      print(fitPdfText(name,bold,9,right-left), left, row, 9, true);
      print(status, left, row - 11, 8.5, false, muted);
    });
  }
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
