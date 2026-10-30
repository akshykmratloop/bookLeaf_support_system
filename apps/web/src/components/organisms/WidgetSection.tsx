import { WIDGET_THEMES, type WidgetTheme } from '@bookleaf/shared';
import { Input, Select, Textarea } from '../atoms/Input';
import { Field } from '../molecules/Field';
import { Section, type SectionProps } from './WorkspaceSettingsSections';

type TextKey = 'brandName' | 'customerNoun' | 'itemNoun' | 'launcherText';
const THEME_LABEL: Record<WidgetTheme, string> = {
  AUTO: 'Match the visitor’s device',
  LIGHT: 'Always light',
  DARK: 'Always dark',
};

const TEXT_FIELDS: { key: TextKey; label: string; hint?: string }[] = [
  { key: 'brandName', label: 'Brand name' },
  { key: 'launcherText', label: 'Launcher button text', hint: 'e.g. Help — empty uses “Help”' },
  { key: 'customerNoun', label: 'What you call a customer', hint: 'e.g. author, borrower, member' },
  { key: 'itemNoun', label: 'What you call an item', hint: 'e.g. book, loan, order' },
];

function OriginsField({ status, isSaving, update, fieldError }: SectionProps) {
  const s = status.settings;
  const error = fieldError('allowedOrigins');
  return (
    <Field
      id="allowedOrigins"
      label="Pages allowed to embed the widget"
      hint="One origin per line, e.g. https://app.example.com"
      error={error}
    >
      <Textarea
        id="allowedOrigins"
        name="allowedOrigins"
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'allowedOrigins-error' : 'allowedOrigins-hint'}
        defaultValue={s.allowedOrigins.join('\n')}
        disabled={isSaving}
        onBlur={(e) => {
          const allowedOrigins = e.target.value
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean);
          if (allowedOrigins.join() !== s.allowedOrigins.join()) update({ allowedOrigins });
        }}
      />
    </Field>
  );
}

function LookFields({ status, isSaving, update, fieldError }: SectionProps) {
  const s = status.settings;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Field id="brandColor" label="Brand colour" error={fieldError('brandColor')}>
        <Input
          id="brandColor"
          type="color"
          defaultValue={s.brandColor}
          disabled={isSaving}
          onBlur={(e) => {
            if (e.target.value !== s.brandColor) update({ brandColor: e.target.value });
          }}
        />
      </Field>
      <Field
        id="logoUrl"
        label="Logo address"
        hint="An https:// image, shown in the widget header"
        error={fieldError('logoUrl')}
      >
        <Input
          id="logoUrl"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={s.logoUrl ?? ''}
          disabled={isSaving}
          aria-describedby="logoUrl-hint"
          onBlur={(e) => {
            const logoUrl = e.target.value.trim() === '' ? null : e.target.value.trim();
            if (logoUrl !== s.logoUrl) update({ logoUrl });
          }}
        />
      </Field>
      <Field id="widgetTheme" label="Widget theme">
        <Select
          id="widgetTheme"
          value={s.widgetTheme}
          disabled={isSaving}
          onChange={(e) => update({ widgetTheme: e.target.value as WidgetTheme })}
        >
          {WIDGET_THEMES.map((t) => (
            <option key={t} value={t}>
              {THEME_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export function WidgetSection(props: SectionProps) {
  const { status, isSaving, update, fieldError } = props;
  const s = status.settings;
  const commit = (key: TextKey) => (value: string) => {
    if (value !== s[key]) update({ [key]: value });
  };
  return (
    <Section
      title="Widget and branding"
      description="Where the support widget may be embedded, how it looks, and the words your customers see."
    >
      <OriginsField {...props} />
      <LookFields {...props} />
      <div className="grid gap-4 md:grid-cols-4">
        {TEXT_FIELDS.map((f) => (
          <Field key={f.key} id={f.key} label={f.label} hint={f.hint} error={fieldError(f.key)}>
            <Input
              id={f.key}
              defaultValue={s[f.key]}
              disabled={isSaving}
              onBlur={(e) => commit(f.key)(e.target.value)}
            />
          </Field>
        ))}
      </div>
    </Section>
  );
}
