import type { CarSetup } from './lsp-parser.ts'

export type ComparisonRow = {
  key: string
  values: (number | string | null)[]
  isDifferent: boolean
}

export type SectionComparison = {
  sectionName: string
  rows: ComparisonRow[]
}

export type ComparisonResult = SectionComparison[]

export function compareSetups(setups: CarSetup[]): ComparisonResult {
  if (setups.length === 0) return []

  // Collect all section names in order of first appearance
  const sectionNames: string[] = []
  const sectionNameSet = new Set<string>()
  for (const setup of setups) {
    for (const name of Object.keys(setup.sections)) {
      if (!sectionNameSet.has(name)) {
        sectionNameSet.add(name)
        sectionNames.push(name)
      }
    }
  }

  return sectionNames.map((sectionName) => {
    // Collect all keys in this section across all setups
    const keyOrder: string[] = []
    const keySet = new Set<string>()
    for (const setup of setups) {
      const section = setup.sections[sectionName]
      if (!section) continue
      for (const key of Object.keys(section.values)) {
        if (!keySet.has(key)) {
          keySet.add(key)
          keyOrder.push(key)
        }
      }
    }

    const rows: ComparisonRow[] = keyOrder.map((key) => {
      const values = setups.map((setup) => {
        const section = setup.sections[sectionName]
        if (!section) return null
        return section.values[key] ?? null
      })

      const nonNull = values.filter((v) => v !== null)
      const isDifferent =
        nonNull.length > 1
          ? nonNull.some((v) => String(v) !== String(nonNull[0]))
          : nonNull.length !== values.length

      return { key, values, isDifferent }
    })

    return { sectionName, rows }
  })
}
