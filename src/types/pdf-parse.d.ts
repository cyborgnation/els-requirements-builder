declare module "pdf-parse/lib/pdf-parse" {
  interface PDFResult {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }

  function pdfParse(buffer: Buffer): Promise<PDFResult>;
  export default pdfParse;
}
