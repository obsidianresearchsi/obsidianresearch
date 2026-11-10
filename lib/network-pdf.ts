import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { deviceLabel, ENVIRONMENTS, estimateNetwork, networkNaira, simulateNetwork, type NetworkPlan, type NetworkPrices } from "./network";
import { fitPdfText, quoteDate, quoteHeader, quoteLogo, QUOTE_NAVY, QUOTE_SIZE, wrapPdfText, type QuoteContact } from "./quote-pdf";
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
const footerRule = 116;
const scheduleFloor = footerRule + 10;
const headerHeight = 23;
const columns = [
  { title:"Link",x:37 }, { title:"From",x:66 }, { title:"To",x:187 },
  { title:"Connection",x:308 }, { title:"Distance",x:393 }, { title:"Status",x:451 },
] as const;

type ScheduleRow = {
  id:string;from:string[];to:string[];connection:string;distance:string;
  status:string;note:string[];tone:"green"|"amber"|"neutral";height:number;
};

function connectionTable(page:PDFPage,top:number,rows:ScheduleRow[],regular:PDFFont,bold:PDFFont) {
  const text=(value:string,x:number,y:number,size:number,font:PDFFont,color=ink)=>
    page.drawText(value,{x,y,size,font,color});
  const tones = {
    green:{ fill:rgb(.89,.96,.92),text:rgb(.12,.39,.28) },
    amber:{ fill:rgb(.99,.92,.83),text:rgb(.53,.30,.11) },
    neutral:{ fill:rgb(.91,.94,.97),text:rgb(.29,.38,.48) },
  };
  page.drawRectangle({x:left,y:top-headerHeight,width:right-left,height:headerHeight,color:navy});
  columns.forEach(({title,x})=>text(title,x+7,top-15,8.3,bold,white));
  let cursor=top-headerHeight;
  rows.forEach((row,index)=>{
    const bottom=cursor-row.height;
    if (index%2===0) page.drawRectangle({x:left,y:bottom,width:right-left,height:row.height,color:paper});
    page.drawLine({start:{x:left,y:bottom},end:{x:right,y:bottom},thickness:.45,color:rgb(.83,.88,.92)});
    const y=cursor-16;
    text(row.id,columns[0].x+7,y,8.2,bold,muted);
    row.from.forEach((line,i)=>text(line,columns[1].x+7,y-i*10,8.6,bold));
    row.to.forEach((line,i)=>text(line,columns[2].x+7,y-i*10,8.6,bold));
    text(row.connection,columns[3].x+7,y,8.6,regular);
    text(row.distance,columns[4].x+7,y,8.6,bold);
    const tone=tones[row.tone];
    const pillX=columns[5].x+7;
    const pillWidth=bold.widthOfTextAtSize(row.status,7.7)+12;
    page.drawRectangle({x:pillX,y:y-4,width:pillWidth,height:13,color:tone.fill});
    text(row.status,pillX+6,y,7.7,bold,tone.text);
    row.note.forEach((line,i)=>text(line,pillX,y-14-i*9,7.3,regular,muted));
    cursor=bottom;
  });
}

function contactFooter(page:PDFPage,contact:QuoteContact,number:string,regular:PDFFont,bold:PDFFont) {
  page.drawLine({start:{x:left,y:footerRule},end:{x:right,y:footerRule},thickness:1,color:teal});
  page.drawText("Obsidian Research",{x:left,y:99,size:10.2,font:bold,color:ink});
  page.drawText(number,{x:right-regular.widthOfTextAtSize(number,8),y:99,size:8,font:regular,color:muted});
  page.drawText("ADDRESS",{x:left,y:83,size:7.4,font:bold,color:muted});
  wrapPdfText(contact.address,regular,8.3,right-left-62,3).forEach((line,index)=>
    page.drawText(line,{x:left+62,y:83-index*10,size:8.3,font:regular,color:ink}));
  const details=[
    { label:"PHONE",value:contact.phone,x:left,width:129 },
    { label:"EMAIL",value:contact.email,x:left+145,width:197 },
    { label:"WEBSITE",value:contact.website.replace(/^https?:\/\//i,"").replace(/\/$/,""),x:left+358,width:163 },
  ];
  for (const {label,value,x,width} of details) {
    page.drawText(label,{x,y:46,size:7.4,font:bold,color:muted});
    page.drawText(fitPdfText(value,regular,8.3,width),{x,y:32,size:8.3,font:regular,color:ink});
  }
}

export async function createNetworkPdf(plan: NetworkPlan, prices: NetworkPrices, equipment: StudioEquipment[], contact:QuoteContact, logoBytes?: Uint8Array) {
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

  const mapSize = 164;
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
  const rows=simulation.links.map(({link,metres,warning},index):ScheduleRow=>{
    const from=wrapPdfText(deviceLabel(nodes.get(link.from)!,equipment),bold,8.6,107,2);
    const to=wrapPdfText(deviceLabel(nodes.get(link.to)!,equipment),bold,8.6,107,2);
    const reachable=simulation.routes.has(link.to);
    const note=warning ? wrapPdfText(warning,regular,7.3,94,2) : [];
    return {
      id:String(index+1).padStart(2,"0"),from,to,connection:link.kind==="bridge" ? "LiteBeam bridge" : "Ethernet",
      distance:link.kind==="bridge" ? `${link.km} km` : `${metres} m`,
      status:warning ? "Review required" : reachable ? "Reachable" : "No upstream",
      note,tone:warning ? "amber" : reachable ? "green" : "neutral",
      height:Math.max(26,13+Math.max(from.length,to.length)*10,note.length ? 26+note.length*9 : 0),
    };
  });
  const inlineTop=mapBottom-56;
  const inline=rows.length>0 && inlineTop-headerHeight-rows.reduce((sum,row)=>sum+row.height,0)>=scheduleFloor;
  if (inline) {
    print("Connection schedule",left,mapBottom-39,13,true);
    connectionTable(page,inlineTop,rows,regular,bold);
  } else if (rows.length) {
    print("See the connection schedule for link distances and simulation status.",left,mapBottom-37,9,false,muted);
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
  if (!inline) {
    const top=671;
    let index=0;
    while (index<rows.length) {
      const detail=doc.addPage(A4);
      quoteHeader(detail,logo,bold,index===0 ? "Connection schedule" : "Connection schedule continued","Network Studio / topology and reachability");
      detail.drawText("Verify cable routes, wireless clearance and hardware compatibility during the site survey.",{
        x:left,y:691,size:9,font:regular,color:muted,
      });
      const start=index;
      let available=top-headerHeight-scheduleFloor;
      while (index<rows.length && rows[index].height<=available) available-=rows[index++].height;
      connectionTable(detail,top,rows.slice(start,index),regular,bold);
    }
  }
  const pages=doc.getPages();
  pages.forEach((sheet,index)=>contactFooter(sheet,contact,`Page ${index+1} of ${pages.length}`,regular,bold));
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
