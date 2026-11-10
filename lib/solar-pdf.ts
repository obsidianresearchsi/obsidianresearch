import { PDFDocument, rgb, StandardFonts, type PDFPage } from "pdf-lib";
import { fitPdfText, quoteDate, quoteHeader, quoteLogo, QUOTE_NAVY, QUOTE_SIZE } from "./quote-pdf";
import type { estimateSolar, Load } from "./solar";

const ink = rgb(.12,.2,.31);
const muted = rgb(.32,.39,.47);
const paper = rgb(.94,.97,.99);
const white = rgb(1,1,1);
const number = new Intl.NumberFormat("en-NG",{maximumFractionDigits:2});
const amount = (kobo: number) => number.format(kobo/100);

export async function createSolarPdf(estimate: ReturnType<typeof estimateSolar>, loads: Load[], logoBytes?: Uint8Array) {
  const doc = await PDFDocument.create();
  doc.setTitle("Obsidian Research - Solar inverter quote");
  doc.setAuthor("Obsidian Research");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await quoteLogo(doc,logoBytes);
  let page: PDFPage;
  let y = 0;
  function addPage(title: string) {
    page = doc.addPage(QUOTE_SIZE);
    quoteHeader(page,logo,bold,title,`Prepared ${quoteDate()}  |  Planning estimate in NGN`);
    page.drawText("Confirm equipment compatibility, site conditions and final costs with Obsidian Research.",{
      x:37,y:32,font:regular,size:8.5,color:muted,
    });
    y=695;
  }
  function line(text: string, size = 10, strong = false, x = 37, width = 520) {
    const font = strong ? bold : regular;
    page.drawText(fitPdfText(text,font,size,width),{ x,y,font,size,color:ink });
  }
  function right(text: string, x: number, strong = false) {
    const font = strong ? bold : regular;
    page.drawText(text,{ x:x-font.widthOfTextAtSize(text,9),y,font,size:9,color:ink });
  }
  addPage("Solar inverter & backup quote");
  line(`Running load ${number.format(estimate.watts)} W  |  Startup ${number.format(estimate.surge)} W  |  Battery bank ${number.format(estimate.bankKwh)} kWh`,11,true);
  y-=17;
  const minutes=Math.floor(estimate.runtimeHours*60);
  line(`Estimated backup: ${minutes<1 ? "less than a minute" : `${Math.floor(minutes/60)} hr ${minutes%60} min`} with all listed appliances running`);
  y-=18;
  line(`Battery voltage class: ${estimate.bankVoltage} V  |  Backup energy for chosen hours: ${number.format(estimate.wattHours/1000)} kWh`);
  y-=31;
  line("Equipment and services",14,true);
  y-=27;
  page!.drawRectangle({x:37,y:y-6,width:520,height:21,color:paper});
  line("Item",9,true,44); right("Qty",342,true); right("Unit cost",436,true); right("Line total",549,true);
  y-=20;
  for(const part of estimate.parts) {
    line(part.label,9,false,44,250);
    right(String(part.quantity),342);
    right(part.price===null ? "-" : amount(part.price),436);
    right(part.price===null ? "Quote required" : amount(part.quantity*part.price),549,true);
    y-=17;
  }
  y-=9;
  page!.drawRectangle({x:37,y:y-9,width:520,height:26,color:QUOTE_NAVY});
  page!.drawText(estimate.pending ? "Priced subtotal" : "Budget estimate",{x:45,y,font:bold,size:11,color:white});
  const total=`NGN ${amount(estimate.subtotal)}`;
  page!.drawText(total,{x:549-bold.widthOfTextAtSize(total,11),y,font:bold,size:11,color:white});
  y-=29;
  line(estimate.pending ? "Some equipment still needs pricing. Confirm the final quote after a site review."
    : "Planning estimate based on the selected equipment and appliances.",9);
  y-=28;
  line("Appliance schedule",14,true);
  y-=20;
  for(const load of loads) {
    if(y<78) addPage("Appliance schedule continued");
    line(`${load.quantity} x ${load.name}`,10,true,37,284);
    line(`${number.format(load.watts)} W each  |  ${number.format(load.hours)} h/day`,9,false,328,220);
    y-=22;
  }
  return new Blob([new Uint8Array(await doc.save())],{type:"application/pdf"});
}
