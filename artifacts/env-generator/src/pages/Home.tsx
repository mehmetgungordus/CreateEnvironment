import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  Copy,
  Download,
  Clipboard,
  Zap,
  Puzzle,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type Annotation = { key: string; label: string; type: "applied" | "warn" | "info" };

type Result = {
  envContent: string;
  annotations: Annotation[];
  summary: string;
  moduleCount: number;
};

const PLACEHOLDER = `Paste chaotically...

E.g.
db connection = postgresql://user:pass@localhost:5432/mydb

secret key: 9as7df8s7df987s9d8f

using vercel? yes

node env: production`;

export default function Home() {
  const [rawText, setRawText] = useState("");
  const [autoDetect, setAutoDetect] = useState(true);
  const [injectPrefix, setInjectPrefix] = useState(true);
  const [generateMissing, setGenerateMissing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText((prev) => (prev ? `${prev}\n${text}` : text));
      toast({ title: "Pasted from clipboard" });
    } catch {
      toast({ title: "Clipboard access denied", variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!rawText.trim()) {
      toast({ title: "Empty input", description: "Paste some config to forge.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const response = await fetch("/api/ai/generate-env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          directives: {
            autoDetectGroups: autoDetect,
            injectVercelPrefix: injectPrefix,
            generateMissingKeys: generateMissing,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast({ title: "Generation failed", description: data.error ?? "Try again.", variant: "destructive" });
        return;
      }

      setResult(data);
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.envContent);
      setCopied(true);
      toast({ title: "Copied raw .env" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([result.envContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = ".env.local";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#0a0b10] text-white/90 selection:bg-[#9b6cff]/40">
      {/* TOP BAR */}
      <header className="border-b border-white/5 bg-[#0d0e15]/80 backdrop-blur">
        <div className="px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9b6cff] to-[#5b8def] flex items-center justify-center">
                <Puzzle className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-semibold tracking-tight text-[15px]">
                EnvForge<span className="text-[#9b6cff]">.ai</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-[11px] uppercase tracking-wider text-white/50 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Zero Server Storage
              <span className="text-white/20">•</span>
              AI Proxied via Backend
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-colors"
              data-testid="link-view-source"
            >
              <ExternalLink className="w-3.5 h-3.5" /> View Source
            </a>
            <div className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Vercel Ready
            </div>
          </div>
        </div>
      </header>

      {/* MAIN SPLIT */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0">
        {/* LEFT: INPUT */}
        <section className="border-r border-white/5 flex flex-col p-6 gap-6 min-h-[calc(100dvh-3.5rem)]">
          {/* Input header */}
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50 font-medium mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9b6cff]" />
              Untamed Input
            </div>
            <p className="text-sm text-white/60">
              Paste raw keys, JSON, or messy config. AI will structure it.
            </p>
          </div>

          {/* Textarea panel */}
          <div className="relative flex-1 min-h-[280px] rounded-xl border border-white/10 bg-[#0d0e15] overflow-hidden focus-within:border-[#9b6cff]/40 transition-colors">
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="h-full w-full resize-none bg-transparent border-0 font-mono text-sm leading-relaxed p-5 pb-14 placeholder:text-white/25 focus-visible:ring-0 focus-visible:ring-offset-0"
              data-testid="textarea-raw-input"
            />
            <div className="absolute bottom-3 right-3">
              <button
                onClick={handlePasteFromClipboard}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors"
                data-testid="button-paste-clipboard"
              >
                <Clipboard className="w-3.5 h-3.5" /> Paste from Clipboard
              </button>
            </div>
          </div>

          {/* Directives */}
          <div className="rounded-xl border border-white/10 bg-[#0d0e15]/60 p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50 font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5b8def]" />
              Transformation Directives
            </div>
            <div className="space-y-4">
              <DirectiveRow
                title="Auto-Detect Groups"
                desc="Group by service (DB, Auth, API)"
                checked={autoDetect}
                onChange={setAutoDetect}
                testId="switch-auto-detect"
              />
              <DirectiveRow
                title="Inject Vercel Prefix"
                desc="Add NEXT_PUBLIC_ to client keys"
                checked={injectPrefix}
                onChange={setInjectPrefix}
                testId="switch-inject-prefix"
              />
              <DirectiveRow
                title="Generate Missing Keys"
                desc="AI suggests common forgotten vars"
                checked={generateMissing}
                onChange={setGenerateMissing}
                testId="switch-generate-missing"
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="h-14 w-full text-base font-semibold tracking-wide bg-gradient-to-r from-[#9b6cff] to-[#7c5cff] hover:from-[#a87dff] hover:to-[#8d6dff] text-white shadow-[0_0_30px_-5px_rgba(155,108,255,0.5)] border border-[#9b6cff]/30"
            data-testid="button-generate"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> FORGING...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2 fill-white" /> GENERATE .ENV FILE
              </>
            )}
          </Button>
        </section>

        {/* RIGHT: OUTPUT */}
        <section className="flex flex-col bg-[#0a0b10] min-h-[calc(100dvh-3.5rem)]">
          {/* Editor header */}
          <div className="flex items-center justify-between px-4 h-11 border-b border-white/5 bg-[#0d0e15]">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5 mr-3">
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
                <div className="w-3 h-3 rounded-full bg-white/10" />
              </div>
              <FileTab name=".env.local" active />
              <FileTab name="next.config.js" />
            </div>
            <div>
              {result ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                  <CheckCircle2 className="w-3 h-3" /> Validated
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md text-[11px] font-medium text-white/40 bg-white/5 border border-white/10">
                  Awaiting Input
                </div>
              )}
            </div>
          </div>

          {/* Code area */}
          <div className="flex-1 overflow-auto">
            {result ? (
              <CodeView content={result.envContent} annotations={result.annotations ?? []} />
            ) : isGenerating ? (
              <div className="h-full flex items-center justify-center text-white/40">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-[#9b6cff]" />
                  <span className="font-mono text-sm">Forging your .env file...</span>
                </div>
              </div>
            ) : (
              <EmptyState />
            )}
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/5 bg-[#0d0e15] px-4 h-12 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="w-6 h-6 rounded-full bg-[#9b6cff]/15 flex items-center justify-center">
                <Puzzle className="w-3 h-3 text-[#9b6cff]" />
              </div>
              {result ? result.summary : "No file generated yet."}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!result}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="button-copy-raw"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                Copy Raw
              </button>
              <button
                onClick={handleDownload}
                disabled={!result}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-xs font-semibold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="button-download-env"
              >
                <Download className="w-3.5 h-3.5" />
                Download .env
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

// -----------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------

function DirectiveRow({
  title,
  desc,
  checked,
  onChange,
  testId,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-white/90">{title}</div>
        <div className="text-xs text-white/50 mt-0.5">{desc}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-[#9b6cff]"
        data-testid={testId}
      />
    </div>
  );
}

function FileTab({ name, active }: { name: string; active?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-md text-xs font-mono ${
        active
          ? "bg-[#9b6cff]/10 text-white border border-[#9b6cff]/20"
          : "text-white/40 hover:text-white/60"
      }`}
    >
      <span className={`w-2 h-2 rounded-sm ${active ? "bg-[#9b6cff]" : "bg-white/20"}`} />
      {name}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center p-12">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-white/5 flex items-center justify-center mb-4">
          <Puzzle className="w-6 h-6 text-white/30" />
        </div>
        <h3 className="text-sm font-medium text-white/70">No file forged yet</h3>
        <p className="text-xs text-white/40 mt-2 leading-relaxed">
          Paste your raw config on the left, set your directives, and hit Generate to watch your
          chaos turn into a clean .env file.
        </p>
      </div>
    </div>
  );
}

function CodeView({ content, annotations }: { content: string; annotations: Annotation[] }) {
  const lines = useMemo(() => content.split("\n"), [content]);

  const annotationByKey = useMemo(() => {
    const map = new Map<string, Annotation>();
    annotations.forEach((a) => {
      if (a && a.key) map.set(a.key.trim(), a);
    });
    return map;
  }, [annotations]);

  return (
    <div className="font-mono text-sm leading-7 py-4">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        const isComment = trimmed.startsWith("#");
        const isEmpty = trimmed === "";
        let keyName: string | null = null;
        let valuePart = "";
        let keyPart = "";

        if (!isComment && !isEmpty && line.includes("=")) {
          const eqIdx = line.indexOf("=");
          keyPart = line.substring(0, eqIdx);
          valuePart = line.substring(eqIdx + 1);
          keyName = keyPart.replace(/^export\s+/, "").trim();
        }

        const annotation = keyName ? annotationByKey.get(keyName) : null;

        return (
          <div
            key={i}
            className="grid grid-cols-[3rem_1fr] hover:bg-white/[0.02] group"
            data-testid={`line-${i + 1}`}
          >
            <div className="text-right pr-4 text-white/20 select-none text-xs leading-7">
              {i + 1}
            </div>
            <div className="pr-6 flex items-center gap-3 flex-wrap">
              {isEmpty ? (
                <span>&nbsp;</span>
              ) : isComment ? (
                <span className="text-white/35">{line}</span>
              ) : keyName ? (
                <>
                  <span>
                    <span className="text-[#7dd3fc]">{keyPart}</span>
                    <span className="text-white/40">=</span>
                    <span className="text-white/85">{valuePart}</span>
                  </span>
                  {annotation && <AnnotationBadge annotation={annotation} />}
                </>
              ) : (
                <span className="text-white/70">{line}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnnotationBadge({ annotation }: { annotation: Annotation }) {
  const styles =
    annotation.type === "warn"
      ? "text-emerald-300 bg-emerald-400/10 border-emerald-400/30"
      : annotation.type === "info"
      ? "text-sky-300 bg-sky-400/10 border-sky-400/30"
      : "text-[#c5a8ff] bg-[#9b6cff]/10 border-[#9b6cff]/30";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap ${styles}`}
    >
      {annotation.label}
    </span>
  );
}
