import { Paperclip } from 'lucide-react';
import { Field } from './Field';

const MAX_FILES = 3;

/** Picks up to three files and shows their names. In this demo, files are not uploaded. */
export function AttachmentPicker({
  files,
  onChange,
}: {
  files: readonly string[];
  onChange: (names: string[]) => void;
}) {
  return (
    <Field
      id="files"
      label="Attachments (optional)"
      hint="Screenshots or photos help us verify issues faster. In this demo, files are not uploaded."
    >
      <label
        htmlFor="files"
        className="flex h-[38px] cursor-pointer items-center gap-2 rounded-control border border-dashed border-line-strong bg-inset px-3 text-[13px] text-ink-2 hover:border-brand"
      >
        <Paperclip size={14} aria-hidden />
        {files.length ? files.join(', ') : 'Choose up to 3 images or PDFs'}
      </label>
      <input
        id="files"
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(e) =>
          onChange([...(e.target.files ?? [])].slice(0, MAX_FILES).map((f) => f.name))
        }
      />
    </Field>
  );
}
