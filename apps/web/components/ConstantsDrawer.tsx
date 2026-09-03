import type { Params } from "@standard-law/engine";

function replacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

export function ConstantsDrawer({ params }: { params: Params }) {
  const notes = Object.entries(params.meta.sourceNotes);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs">
      <h3 className="mb-2 text-sm font-medium text-white/70">Constants (params.json)</h3>
      {notes.length > 0 && (
        <div className="mb-3 space-y-1 rounded border border-expansion/30 bg-expansion/5 p-2 text-expansion">
          {notes.map(([k, v]) => (
            <p key={k}>
              <span className="font-mono">{k}</span>: {v}
            </p>
          ))}
        </div>
      )}
      <pre className="max-h-64 overflow-auto text-white/60">
        {JSON.stringify(params, replacer, 2)}
      </pre>
    </div>
  );
}
