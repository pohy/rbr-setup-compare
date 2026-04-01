export function exhaustiveCheck(value: never): never {
  throw new Error(`Unhandled value: ${value}`);
}
