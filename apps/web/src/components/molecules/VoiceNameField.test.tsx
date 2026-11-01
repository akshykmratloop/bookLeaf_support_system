import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SamplePlayButton } from '../atoms/SamplePlayButton';
import { VoiceNameField } from './VoiceNameField';

const VOICES = ['marin', 'cedar'];
const SAMPLES = {
  marin: '/voice-samples/openai/marin.mp3',
  cedar: '/voice-samples/openai/cedar.mp3',
};

const render = (props: Partial<Parameters<typeof VoiceNameField>[0]> = {}) =>
  renderToStaticMarkup(
    <VoiceNameField
      value="marin"
      voices={VOICES}
      samples={SAMPLES}
      disabled={false}
      onCommit={() => undefined}
      {...props}
    />,
  );

describe('VoiceNameField', () => {
  it('shows a play button for the chosen voice beside the list', () => {
    const html = render();
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Play sample of marin"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('has no play button when the chosen voice has no sample', () => {
    expect(render({ samples: {} })).not.toContain('Play sample');
    expect(render({ value: 'robot' })).not.toContain('Play sample');
  });

  it('falls back to a text box, without previews, when the provider lists no voices', () => {
    const html = render({ voices: [] });
    expect(html).toContain('<input');
    expect(html).not.toContain('Play sample');
  });
});

describe('SamplePlayButton', () => {
  it('says Stop while playing, and keeps list-row buttons out of the tab order', () => {
    const playing = renderToStaticMarkup(
      <SamplePlayButton voice="cedar" isPlaying onToggle={() => undefined} size="row" />,
    );
    expect(playing).toContain('aria-label="Stop sample of cedar"');
    expect(playing).toContain('aria-pressed="true"');
    expect(playing).toContain('tabindex="-1"');
    const field = renderToStaticMarkup(
      <SamplePlayButton voice="cedar" isPlaying={false} onToggle={() => undefined} />,
    );
    expect(field).not.toContain('tabindex');
  });
});
