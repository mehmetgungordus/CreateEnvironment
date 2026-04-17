export interface EnvEntry {
  id: string;
  key: string;
  value: string;
}

export function parseEnvContent(content: string): EnvEntry[] {
  const lines = content.split('\n');
  const entries: EnvEntry[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Handle 'export KEY=value'
    let processLine = trimmed;
    if (processLine.startsWith('export ')) {
      processLine = processLine.substring(7).trim();
    }
    
    const equalIdx = processLine.indexOf('=');
    if (equalIdx === -1) continue;
    
    const key = processLine.substring(0, equalIdx).trim();
    let value = processLine.substring(equalIdx + 1).trim();
    
    // Remove surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.substring(1, value.length - 1);
    }
    
    if (key) {
      entries.push({ id: crypto.randomUUID(), key, value });
    }
  }
  
  return entries;
}
