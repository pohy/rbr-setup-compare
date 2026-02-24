import { parseLspSetup, type CarSetup } from './lsp-parser.ts'
import { sanitizeSetup } from './sanitize.ts'

import tarmacRaw from '../../data/Skoda_Fabia_S2000_Evo_2_ngp6/tarmac.lsp?raw'
import rTarmacRaw from '../../data/Skoda_Fabia_S2000_Evo_2_ngp6/r_tarmac.lsp?raw'
import dTarmacRaw from '../../data/Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp?raw'

const EXAMPLE_FILES: { name: string; content: string }[] = [
  { name: 'tarmac.lsp', content: tarmacRaw },
  { name: 'r_tarmac.lsp', content: rTarmacRaw },
  { name: 'd_tarmac.lsp', content: dTarmacRaw },
]

export function loadExampleSetups(): CarSetup[] {
  return EXAMPLE_FILES.map(({ name, content }) =>
    sanitizeSetup(parseLspSetup(content, name)),
  )
}
