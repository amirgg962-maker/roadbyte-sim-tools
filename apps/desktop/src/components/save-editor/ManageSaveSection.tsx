import { useMemo, useState, type FormEvent } from "react";
import { Button, Input } from "ui";
import { useSettingsStore } from "../../stores/settings";
import { translate } from "../../i18n";
import {
  ArrowRight,
  CheckCircle2,
  CopyPlus,
  FilePenLine,
  Info,
  LockKeyhole,
  Trash2,
} from "lucide-react";

interface ManageSaveSectionProps {
  saveName: string;
  readOnly: boolean;
  busy: boolean;
  onRename: (newName: string) => Promise<boolean>;
  onClone: (newName: string) => Promise<boolean>;
  onDelete: () => void;
}

type PendingOperation = "rename" | "clone" | null;

function validateSaveName(value: string, currentName: string): string | null {
  const name = value.trim();
  if (!name) return "Enter a name to continue.";
  if (name.length > 64) return "Use 64 characters or fewer.";
  if (!/^[\p{L}\p{N}_-]+$/u.test(name)) {
    return "Use letters, numbers, underscores (_) or hyphens (-) only.";
  }
  if (name.toLowerCase() === currentName.toLowerCase()) {
    return "Choose a different name from the current save.";
  }
  return null;
}

function OperationCard({
  kind,
  title,
  description,
  value,
  onValueChange,
  onSubmit,
  error,
  readOnly,
  busy,
  operationPending,
}: {
  kind: "rename" | "clone";
  title: string;
  description: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string | null;
  readOnly: boolean;
  busy: boolean;
  operationPending: boolean;
}) {
  const isRename = kind === "rename";
  const Icon = isRename ? FilePenLine : CopyPlus;
  const inputId = `save-${kind}-name`;
  const errorId = `${inputId}-error`;

  return (
    <section className="min-w-0 rounded-2xl border border-border/60 bg-card/45 p-5 shadow-sm transition-colors hover:border-primary/25">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
      </div>

      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <label htmlFor={inputId} className="text-xs font-medium text-foreground/85">
          {isRename ? "New save name" : "Name for the copy"}
        </label>
        <Input
          id={inputId}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={isRename ? "e.g. main_profile" : "e.g. before_tuning"}
          disabled={readOnly || busy}
          maxLength={64}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : `${inputId}-hint`}
          className="h-11 rounded-xl border-border/70 bg-background/70 font-mono text-sm focus-visible:ring-primary/35"
        />
        {error ? (
          <p id={errorId} className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
            Folder name: letters, numbers, _ and - · Up to 64 characters.
          </p>
        )}
        <Button
          type="submit"
          variant={isRename ? "secondary" : "default"}
          className="h-10 w-full justify-between rounded-xl"
          disabled={readOnly || busy || Boolean(error) || !value.trim()}
        >
          <span>{operationPending ? (isRename ? "Renaming save…" : "Creating copy…") : title}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </form>
    </section>
  );
}

export function ManageSaveSection({
  saveName,
  readOnly,
  busy,
  onRename,
  onClone,
  onDelete,
}: ManageSaveSectionProps) {
  const language = useSettingsStore((state) => state.language);
  const t = (text: string) => translate(language, text);
  const [rename, setRename] = useState("");
  const [clone, setClone] = useState("");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);

  const renameError = useMemo(
    () => (rename.trim() ? validateSaveName(rename, saveName) : null),
    [rename, saveName],
  );
  const cloneError = useMemo(
    () => (clone.trim() ? validateSaveName(clone, saveName) : null),
    [clone, saveName],
  );
  const operationBusy = busy || pendingOperation !== null;

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = rename.trim();
    if (readOnly || operationBusy || !value || validateSaveName(value, saveName)) return;

    setPendingOperation("rename");
    try {
      const succeeded = await onRename(value);
      if (succeeded) setRename("");
    } finally {
      setPendingOperation(null);
    }
  }

  async function handleClone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = clone.trim();
    if (readOnly || operationBusy || !value || validateSaveName(value, saveName)) return;

    setPendingOperation("clone");
    try {
      const succeeded = await onClone(value);
      if (succeeded) setClone("");
    } finally {
      setPendingOperation(null);
    }
  }

  return (
    <div className="space-y-5 pb-2">
      <section className="rounded-2xl border border-border/60 bg-card/35 p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
              <FilePenLine className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Roadbyte · Save management
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
                Manage save file
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                Rename this save, create a separate copy for experiments, or remove it from the
                profile.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            <span className="truncate font-mono">{saveName}</span>
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-sky-500/20 bg-sky-500/[0.045] p-4">
          <p className="text-xs font-semibold text-sky-200">{t("Safe experiment path")}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t(
              "Roadbyte creates and opens a separate copy so you can experiment without touching the original. Each actual save edit creates a restorable backup first.",
            )}
          </p>
        </div>

        {readOnly ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-4 text-amber-200">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Read-only protection is enabled</p>
              <p className="mt-1 text-xs leading-5 text-amber-100/70">
                Rename, copy, and delete actions are paused. Switch Read Only off in the lower-left
                corner when you are ready to manage this save.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-4 text-emerald-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Edit mode is enabled</p>
              <p className="mt-1 text-xs leading-5 text-emerald-100/70">
                Changes apply to the selected save. For important profiles, create a copy before
                experimenting.
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <OperationCard
            kind="rename"
            title="Rename save"
            description="Changes the save folder name and, when present, the name stored in info.sii."
            value={rename}
            onValueChange={setRename}
            onSubmit={handleRename}
            error={renameError}
            readOnly={readOnly}
            busy={operationBusy}
            operationPending={pendingOperation === "rename"}
          />
          <OperationCard
            kind="clone"
            title={t("Create an experiment copy")}
            description={t(
              "Creates and selects a separate save in this profile. Experiment on the copy while the original stays untouched; edits create their own backup.",
            )}
            value={clone}
            onValueChange={setClone}
            onSubmit={handleClone}
            error={cloneError}
            readOnly={readOnly}
            busy={operationBusy}
            operationPending={pendingOperation === "clone"}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-destructive/25 bg-destructive/[0.035] p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-destructive/25 bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Delete this save</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                Removes the selected save from the game profile. A full folder backup must be
                created successfully before deletion proceeds.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="h-10 shrink-0 rounded-xl"
            onClick={onDelete}
            disabled={readOnly || operationBusy}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Delete save…
          </Button>
        </div>
        <div className="mt-4 flex items-start gap-2 border-t border-destructive/10 pt-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            The deletion requires confirmation. The backup is stored separately from the save folder
            being removed.
          </p>
        </div>
      </section>
    </div>
  );
}
