import { parseLspSetup, type CarSetup } from './lsp-parser.ts'
import { sanitizeSetup } from './sanitize.ts'

import dTarmacRaw from '../../data/Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_tarmac.lsp?raw'
import dGravelRaw from '../../data/Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_gravel.lsp?raw'
import dSnowRaw from '../../data/Skoda_Fabia_S2000_Evo_2_ngp6/setups/d_snow.lsp?raw'

const EXAMPLE_FILES: { name: string; content: string }[] = [
  { name: 'd_tarmac.lsp', content: dTarmacRaw },
  { name: 'd_gravel.lsp', content: dGravelRaw },
  { name: 'd_snow.lsp', content: dSnowRaw },
]

export function loadExampleSetups(): CarSetup[] {
  return EXAMPLE_FILES.map(({ name, content }) =>
    sanitizeSetup(parseLspSetup(content, name)),
  )
}
