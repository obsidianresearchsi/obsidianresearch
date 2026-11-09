"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return <button className="button button-dark no-print" onClick={() => window.print()} type="button"><Printer size={17} aria-hidden />Print or save PDF</button>;
}
