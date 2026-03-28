export function isOverwritable(relativePath: string): boolean {
  return relativePath.startsWith("SavedGames/");
}

export function savedGamesCarDir(relativePath: string): string | null {
  const parts = relativePath.split("/");

  // rsfdata/cars/{carDir}/setups/{file}
  if (parts[0] === "rsfdata" && parts[1] === "cars" && parts.length >= 5) return parts[2];
  // rsfdata/setups/{carDir}/{file}
  if (parts[0] === "rsfdata" && parts[1] === "setups" && parts.length >= 4) return parts[2];
  // Physics/{carDir}/setups/{file}
  if (parts[0] === "Physics" && parts.length >= 4) return parts[1];
  // SavedGames/{carDir}/{file}
  if (parts[0] === "SavedGames" && parts.length >= 3) return parts[1];

  return null;
}
