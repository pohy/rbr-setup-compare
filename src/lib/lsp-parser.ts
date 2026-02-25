export type SetupSection = {
  id: string;
  values: Record<string, number | string>;
};

export type CarSetup = {
  name: string;
  sections: Record<string, SetupSection>;
};

type Token = string;

function tokenize(text: string): Token[] {
  const stripped = text.replace(/;[^\n]*/g, "");
  const tokens: Token[] = [];
  let i = 0;
  while (i < stripped.length) {
    const ch = stripped[i];
    if (ch === "(" || ch === ")") {
      tokens.push(ch);
      i++;
    } else if (ch === '"') {
      let j = i + 1;
      while (j < stripped.length && stripped[j] !== '"') j++;
      tokens.push(stripped.slice(i, j + 1));
      i = j + 1;
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      let j = i;
      while (j < stripped.length && !/[\s()""]/.test(stripped[j])) j++;
      tokens.push(stripped.slice(i, j));
      i = j;
    }
  }
  return tokens;
}

function isNumeric(s: string): boolean {
  return /^[+-]?\d+(\.\d+)?$/.test(s);
}

const WHEEL_SUFFIX: Record<string, string> = {
  CAR_WHEEL_LF: "LF",
  CAR_WHEEL_RF: "RF",
  CAR_WHEEL_LB: "LB",
  CAR_WHEEL_RB: "RB",
};

export function parseLspSetup(text: string, name: string): CarSetup {
  const tokens = tokenize(text);
  const sections: Record<string, SetupSection> = {};
  let pos = 0;

  function peek(): Token | undefined {
    return tokens[pos];
  }
  function next(): Token {
    return tokens[pos++];
  }
  function expect(val: string) {
    const t = next();
    if (t !== val) throw new Error(`Expected "${val}", got "${t}" at token ${pos - 1}`);
  }
  function unquote(s: string): string {
    return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
  }
  function isQuoted(s: string): boolean {
    return s.startsWith('"') && s.endsWith('"');
  }

  // Parse key-value pairs and nested sub-sections within a section body.
  // parentSectionId is used to derive position suffixes for nested sections.
  function parseKeyValues(sectionName: string, sectionId: string) {
    const values: Record<string, number | string> = {};

    while (peek() !== ")" && pos < tokens.length) {
      const tok = peek();
      if (tok === undefined || tok === "(" || tok === ")") break;

      // Check if this is a sub-section: bare word followed by (
      if (!isNumeric(tok) && tokens[pos + 1] === "(") {
        const subName = next();
        expect("(");
        const subId = unquote(next());
        const suffix = WHEEL_SUFFIX[sectionId] ?? "";
        const flatName = suffix ? `${subName}${suffix}` : subName;
        parseKeyValues(flatName, subId);
        expect(")");
        continue;
      }

      next(); // consume key

      const nums: string[] = [];
      while (peek() !== undefined && peek() !== ")" && isNumeric(peek() as string)) {
        nums.push(next());
      }

      if (nums.length === 1) {
        values[tok] = parseFloat(nums[0]);
      } else if (nums.length > 1) {
        values[tok] = nums.map((n) => parseFloat(n).toString()).join(" ");
      }
    }

    if (Object.keys(values).length > 0) {
      sections[sectionName] = { id: sectionId, values };
    }
  }

  // Top level: (( "rootId" ...))
  expect("(");
  expect("(");
  next(); // root id (e.g. "PhysicsEngine" or "(null)")

  // Skip bare word if present (e.g. "DefManager", "CarOptions")
  const afterRootId = peek();
  if (afterRootId && !isQuoted(afterRootId) && afterRootId !== "(" && afterRootId !== ")") {
    next();
  }

  // Now determine format based on what follows
  if (peek() === "(") {
    if (tokens[pos + 1] === "(") {
      // PhysicsEngine format: ( ("Type" ("Id" ...)) ... )
      expect("(");
      while (peek() === "(") {
        next(); // (
        const sectionType = unquote(next());
        expect("(");
        const sectionId = unquote(next());
        const suffix = WHEEL_SUFFIX[sectionId] ?? "";
        const flatName = suffix ? `${sectionType}${suffix}` : sectionType;
        parseKeyValues(flatName, sectionId);
        expect(")"); // close body
        expect(")"); // close section
      }
      expect(")"); // close wrapper
    } else {
      // Options format: ("id" ...) SectionName ("id" ...) ...
      // But we already consumed the first section name as "afterRootId"
      // Actually, we skipped it. We need to re-read what happened.
      // After (( "rootId" bareWord, we're at ( "id" ...)
      // The bareWord was actually the first section name.
      // We need to use it.
      // Let's backtrack: the token we consumed with "Skip bare word" IS the section name.
      parseSectionsFlat(afterRootId as string);
    }
  }

  // Consume remaining closing parens
  while (peek() === ")") next();

  return { name, sections };

  // Options-format parser: SectionName was already consumed, now at ("id" ...)
  function parseSectionsFlat(firstSectionName: string) {
    let sectionName: string | null = firstSectionName;
    while (sectionName && peek() === "(") {
      expect("(");
      const sectionId = unquote(next());
      parseKeyValues(sectionName, sectionId);
      expect(")");

      // Next section name or end
      if (peek() && peek() !== ")") {
        sectionName = next();
      } else {
        sectionName = null;
      }
    }
  }
}
