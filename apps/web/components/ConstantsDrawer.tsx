import type { Params } from "@standard-law/engine";

function replacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

export function ConstantsDrawer({ params }: { params: Params }) {
  const notes = Object.entries(params.meta.sourceNotes);
  return (
    <div className="rounded-xl border border-white/[0.06] bg-surface p-5 text-xs shadow-card">
      <h3 className="mb-3 font-display text-sm font-medium tracking-wide text-white/75">
        Constants (params.json)
      </h3>
      {notes.length > 0 && (
        <div className="mb-4 space-y-1 rounded-lg border border-expansion/20 bg-expansion/[0.06] p-3 text-expansion">
          {notes.map(([k, v]) => (
            <p key={k}>
              <span className="font-mono">{k}</span>: {v}
            </p>
          ))}
        </div>
      )}
      <pre className="max-h-64 overflow-auto rounded-lg border border-white/[0.05] bg-black/20 p-3 font-mono text-white/55">
        {JSON.stringify(params, replacer, 2)}
      </pre>
    </div>
  );
}
