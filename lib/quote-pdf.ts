import { rgb, type PDFDocument, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export const QUOTE_SIZE: [number,number] = [595.28,841.89];
export const QUOTE_NAVY = rgb(.07,.13,.22);
export type QuoteContact = { address:string;phone:string;email:string;website:string };

export async function quoteLogo(doc: PDFDocument, provided?: Uint8Array) {
  if (provided) return doc.embedPng(provided);
  const response = await fetch("/media/logo-white.png");
  if (!response.ok) throw new Error("Could not load the Obsidian Research logo.");
  return doc.embedPng(await response.arrayBuffer());
}

export function quoteHeader(page: PDFPage, logo: PDFImage, font: PDFFont, title: string, subtitle: string) {
  const white = rgb(1,1,1);
  page.drawRectangle({ x:0,y:721,width:QUOTE_SIZE[0],height:QUOTE_SIZE[1]-721,color:QUOTE_NAVY });
  const mark = logo.scale(134/logo.width);
  page.drawImage(logo,{ x:37,y:815-mark.height,width:mark.width,height:mark.height });
  page.drawText(title,{ x:37,y:762,font,size:24,color:white });
  page.drawText(subtitle,{ x:37,y:738,font,size:9,color:white });
}

export function quoteDate() {
  return new Intl.DateTimeFormat("en-NG",{ dateStyle:"medium",timeZone:"Africa/Lagos" }).format(new Date());
}

export function fitPdfText(text: string, font: PDFFont, size: number, width: number) {
  const characters = new Set(font.getCharacterSet());
  const printable = Array.from(text.normalize("NFKD")).filter((letter) => !/\p{Mark}/u.test(letter))
    .map((letter) => characters.has(letter.codePointAt(0)!) ? letter : " ").join("").replace(/\s+/g," ").trim();
  if (font.widthOfTextAtSize(printable,size)<=width) return printable;
  let prefix = printable;
  while (prefix && font.widthOfTextAtSize(`${prefix}...`,size)>width) prefix=prefix.slice(0,-1);
  return `${prefix.trimEnd()}...`;
}

export function wrapPdfText(text:string,font:PDFFont,size:number,width:number,maxLines:number) {
  const words=fitPdfText(text,font,size,Infinity).split(" ");
  const lines:string[]=[];
  let line="";
  while (words.length && lines.length<maxLines-1) {
    const word=words[0];
    const next=line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next,size)<=width) {
      line=next;
      words.shift();
    } else if (line) {
      lines.push(line);
      line="";
    } else {
      lines.push(fitPdfText(word,font,size,width));
      words.shift();
    }
  }
  const remaining=[line,...words].filter(Boolean).join(" ");
  if (remaining) lines.push(fitPdfText(remaining,font,size,width));
  return lines;
}

export function downloadQuote(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href=url;
  link.download=filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url),30_000);
}
