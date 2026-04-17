import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { parseEnvContent, EnvEntry } from "@/lib/env-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, Copy, Download, Eye, EyeOff, Plus, Trash2, Zap, AlertCircle, Info, AlertTriangle, ChevronDown, ChevronRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export default function Home() {
  const [entries, setEntries] = useState<EnvEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<{
    envContent: string;
    suggestions: { key: string; suggestion: string; severity: "info" | "warning" | "error" }[];
    summary: string;
  } | null>(null);
  
  const [pasteContent, setPasteContent] = useState("");
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const addEntry = () => {
    setEntries([...entries, { id: crypto.randomUUID(), key: "", value: "" }]);
  };

  const removeEntry = (id: string) => {
    setEntries(entries.filter((e) => e.id !== id));
  };

  const updateEntry = (id: string, field: "key" | "value", val: string) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: val } : e)));
  };

  const handlePaste = () => {
    const parsed = parseEnvContent(pasteContent);
    if (parsed.length > 0) {
      setEntries([...entries, ...parsed]);
      toast({ title: "Variables imported", description: `Added ${parsed.length} variables.` });
      setPasteModalOpen(false);
      setPasteContent("");
    } else {
      toast({ title: "No variables found", description: "Could not parse any valid key=value pairs.", variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    const validEntries = entries.filter((e) => e.key.trim() !== "");
    if (validEntries.length === 0) {
      toast({ title: "No variables", description: "Add at least one variable to analyze.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setResults(null);

    try {
      const response = await fetch("/api/ai/generate-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: validEntries.map(e => ({ key: e.key, value: e.value })) }),
      });

      if (!response.ok) throw new Error("Failed to generate");

      const data = await response.json();
      setResults(data);
      toast({ title: "Analysis complete", description: "Successfully analyzed your environment variables." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to communicate with AI.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-background text-foreground selection:bg-primary/30">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold">
              EC
            </div>
            <h1 className="font-semibold tracking-tight text-lg">EnvCraft</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden sm:block">
              {entries.length} variables
            </div>
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} data-testid="button-theme-toggle">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Editor & Results */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Privacy Banner */}
          <Collapsible className="bg-blue-500/10 border border-blue-500/20 rounded-lg overflow-hidden">
            <div className="px-4 py-3 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-500">Privacy First</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your data never touches our database. All processing is transient.
                </p>
                <CollapsibleTrigger className="text-xs text-blue-500 hover:text-blue-400 font-medium flex items-center gap-1 mt-2">
                  Read more details <ChevronDown className="w-3 h-3" />
                </CollapsibleTrigger>
                <CollapsibleContent className="text-xs text-muted-foreground mt-2 space-y-2">
                  <p>When you click "Analyze", your keys and values are sent securely to our AI for formatting and validation, but they are never logged, stored, or saved on our servers.</p>
                  <p>The resulting .env file is generated purely in your browser session.</p>
                </CollapsibleContent>
              </div>
            </div>
          </Collapsible>

          {/* Input Section */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-card/50 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Environment Variables</CardTitle>
                  <CardDescription>Add, paste, or edit your deployment config</CardDescription>
                </div>
                <Dialog open={pasteModalOpen} onOpenChange={setPasteModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-paste-env">
                      Paste .env
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Paste .env content</DialogTitle>
                    </DialogHeader>
                    <Textarea
                      className="min-h-[200px] font-mono text-sm"
                      placeholder="KEY=value&#10;NEXT_PUBLIC_API_URL=https://..."
                      value={pasteContent}
                      onChange={(e) => setPasteContent(e.target.value)}
                      data-testid="textarea-paste-content"
                    />
                    <div className="flex justify-end gap-2 mt-4">
                      <Button variant="ghost" onClick={() => setPasteModalOpen(false)}>Cancel</Button>
                      <Button onClick={handlePaste} data-testid="button-import-pasted">Import</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {entries.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                    <Plus className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-medium mb-1">No variables yet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                    Start adding variables manually or paste your existing .env file to let our AI analyze it.
                  </p>
                  <Button onClick={addEntry} data-testid="button-add-first">
                    <Plus className="w-4 h-4 mr-2" /> Add Variable
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border/30">
                  {entries.map((entry, index) => (
                    <EnvRow
                      key={entry.id}
                      entry={entry}
                      onUpdate={(field, val) => updateEntry(entry.id, field, val)}
                      onRemove={() => removeEntry(entry.id)}
                      index={index}
                    />
                  ))}
                  <div className="p-4 bg-muted/10 flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={addEntry} className="text-muted-foreground hover:text-foreground" data-testid="button-add-row">
                      <Plus className="w-4 h-4 mr-2" /> Add row
                    </Button>
                    <Button 
                      onClick={handleGenerate} 
                      disabled={isGenerating || entries.every(e => !e.key)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-primary/20 shadow-lg"
                      data-testid="button-analyze"
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 mr-2" /> Analyze & Generate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          {results && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Summary & Suggestions */}
              <Card className="border-primary/20 bg-primary/5 shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="text-lg font-medium text-primary">AI Analysis</h3>
                        <p className="text-sm text-muted-foreground mt-1">{results.summary}</p>
                      </div>
                      
                      {results.suggestions.length > 0 && (
                        <div className="space-y-2 mt-4">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Suggestions</h4>
                          <div className="space-y-2">
                            {results.suggestions.map((s, i) => (
                              <div key={i} className="flex items-start gap-2 bg-background/50 p-3 rounded border border-border/50">
                                {s.severity === 'error' && <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />}
                                {s.severity === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5" />}
                                {s.severity === 'info' && <Info className="w-4 h-4 text-blue-500 mt-0.5" />}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold">{s.key}</span>
                                    <Badge variant="outline" className={`text-[10px] uppercase h-5 px-1.5 ${s.severity === 'error' ? 'text-destructive border-destructive/30' : s.severity === 'warning' ? 'text-yellow-500 border-yellow-500/30' : 'text-blue-500 border-blue-500/30'}`}>
                                      {s.severity}
                                    </Badge>
                                  </div>
                                  <p className="text-sm mt-1">{s.suggestion}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Code Preview */}
              <Card className="border-border/50 overflow-hidden bg-[#0f1117]">
                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#1a1d27]">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                  </div>
                  <span className="text-xs text-white/50 font-mono">.env</span>
                  <CopyButton text={results.envContent} />
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="font-mono text-sm leading-relaxed">
                    <CodeHighlighted content={results.envContent} />
                  </pre>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-white/10 bg-[#1a1d27]">
                  <Button variant="outline" size="sm" className="bg-transparent text-white/80 hover:bg-white/10 hover:text-white border-white/20" onClick={() => downloadFile(".env", results.envContent)} data-testid="button-download-env">
                    <Download className="w-4 h-4 mr-2" /> Download .env
                  </Button>
                  <Button variant="outline" size="sm" className="bg-transparent text-white/80 hover:bg-white/10 hover:text-white border-white/20" onClick={() => downloadFile(".env.example", generateExample(results.envContent))} data-testid="button-download-example">
                    <Download className="w-4 h-4 mr-2" /> Download .example
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-muted/30 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Vercel Pro Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-1">
                <h4 className="font-medium text-foreground">NEXT_PUBLIC_</h4>
                <p>Variables starting with <code className="text-xs bg-muted px-1 py-0.5 rounded">NEXT_PUBLIC_</code> are exposed to the browser. Never use this for secrets.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-foreground">Git Security</h4>
                <p>Never commit your .env files to source control. Commit your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.example</code> instead.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-foreground">Auto-injection</h4>
                <p>Vercel automatically injects your environment variables at runtime. You don't need the dotenv package in production.</p>
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-foreground">Database URLs</h4>
                <p>Ensure strings like <code className="text-xs bg-muted px-1 py-0.5 rounded">DATABASE_URL</code> do not have trailing slashes or unsupported query parameters depending on your ORM.</p>
              </div>
            </CardContent>
          </Card>
        </div>

      </main>
    </div>
  );
}

// ----------------------------------------------------
// Subcomponents
// ----------------------------------------------------

function EnvRow({ entry, onUpdate, onRemove, index }: { entry: EnvEntry; onUpdate: (field: "key"|"value", val: string) => void; onRemove: () => void; index: number }) {
  const [showValue, setShowValue] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 group hover:bg-muted/5 transition-colors">
      <div className="w-full sm:w-1/3">
        <Input 
          placeholder="KEY_NAME" 
          value={entry.key} 
          onChange={(e) => onUpdate("key", e.target.value.toUpperCase().replace(/\s+/g, '_'))}
          className="font-mono text-sm uppercase bg-transparent border-border/50 focus-visible:ring-primary/50"
          data-testid={`input-key-${index}`}
        />
      </div>
      <div className="hidden sm:block text-muted-foreground font-mono text-sm">=</div>
      <div className="w-full sm:flex-1 relative">
        <Input 
          type={showValue ? "text" : "password"}
          placeholder="Value" 
          value={entry.value} 
          onChange={(e) => onUpdate("value", e.target.value)}
          className="font-mono text-sm bg-transparent border-border/50 focus-visible:ring-primary/50 pr-10"
          data-testid={`input-value-${index}`}
        />
        <button 
          onClick={() => setShowValue(!showValue)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          data-testid={`button-toggle-visibility-${index}`}
        >
          {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onRemove} 
        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto shrink-0"
        data-testid={`button-remove-row-${index}`}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function CodeHighlighted({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <>
      {lines.map((line, i) => {
        if (line.trim().startsWith('#')) {
          return <div key={i} className="text-green-500/70">{line}</div>;
        }
        if (line.includes('=')) {
          const idx = line.indexOf('=');
          const key = line.substring(0, idx);
          const val = line.substring(idx + 1);
          return (
            <div key={i}>
              <span className="text-cyan-400 font-bold">{key}</span>
              <span className="text-white/60">=</span>
              <span className="text-white/90">{val}</span>
            </div>
          );
        }
        return <div key={i} className="text-white/80">{line}</div>;
      })}
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleCopy} 
      className="text-white/50 hover:text-white hover:bg-white/10 h-7 px-2"
      data-testid="button-copy-env"
    >
      {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
      <span className="text-xs">Copy</span>
    </Button>
  );
}

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateExample(content: string): string {
  return content.split('\n').map(line => {
    if (line.trim().startsWith('#') || !line.includes('=')) return line;
    const idx = line.indexOf('=');
    const key = line.substring(0, idx);
    return `${key}="your_${key.toLowerCase()}_here"`;
  }).join('\n');
}
