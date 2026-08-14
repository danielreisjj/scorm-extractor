import { existsSync } from "node:fs";
import { join } from "node:path";

export const OUTPUT_DIR = join(process.cwd(), "output");
export const SAMPLE_DIR = join(process.cwd(), "scorms");

export interface SamplePackage {
  name: string;
  file: string;
  includeBytes: {
    images: boolean;
    pdfs: boolean;
    videos: boolean;
  };
}

export const SAMPLE_PACKAGES: SamplePackage[] = [
  {
    name: "Atletismo_M04",
    file: "Atletismo_M04.zip",
    includeBytes: { images: true, pdfs: false, videos: false },
  },
  {
    name: "Atletismo_M05",
    file: "Atletismo_M05.zip",
    includeBytes: { images: true, pdfs: false, videos: false },
  },
  {
    name: "Novo_CIEVO_M01",
    file: "Novo_CIEVO_M01.zip",
    includeBytes: { images: false, pdfs: false, videos: false },
  },
  {
    name: "Novo_CIEVO_M02",
    file: "Novo_CIEVO_M02.zip",
    includeBytes: { images: false, pdfs: false, videos: false },
  },
  {
    name: "Novo_CIEVO_M03",
    file: "Novo_CIEVO_M03.zip",
    includeBytes: { images: false, pdfs: false, videos: false },
  },
  {
    name: "biologicas-anatomia-no-esporte",
    file: "biologicas-anatomia-no-esporte.zip",
    includeBytes: { images: false, pdfs: false, videos: false },
  },
  {
    name: "COB_0666_11_Prevencao_e_Enfrentamento_do_Assedio_M01-scorm",
    file: "COB_0666_11_Prevencao_e_Enfrentamento_do_Assedio_M01-scorm.zip",
    includeBytes: { images: false, pdfs: false, videos: false },
  },
  {
    name: "M3",
    file: "M3.zip",
    includeBytes: { images: false, pdfs: false, videos: false },
  },
];

export function samplePath(file: string): string {
  return join(SAMPLE_DIR, file);
}

export function sampleExists(file: string): boolean {
  return existsSync(samplePath(file));
}
