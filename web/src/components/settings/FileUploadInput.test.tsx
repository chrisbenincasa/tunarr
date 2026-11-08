import { renderWithProviders, screen, userEvent, waitFor } from '@/test/utils';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { FileUploadInputProps } from './FileUploadInput.tsx';
import { FileUploadInput } from './FileUploadInput.tsx';

type Overrides = Partial<
  Pick<FileUploadInputProps, 'upload' | 'onUploadError' | 'accept'>
>;

function Harness({
  initialValue = '',
  onFormValueChange,
  ...overrides
}: Overrides & {
  initialValue?: string;
  onFormValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <FileUploadInput
      label="Soundtrack"
      accept={overrides.accept ?? 'audio/*'}
      upload={overrides.upload ?? (() => Promise.resolve(''))}
      onUploadError={overrides.onUploadError ?? vi.fn()}
      value={value}
      onFormValueChange={(next) => {
        setValue(next);
        onFormValueChange?.(next);
      }}
    />
  );
}

function fileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type=file]');
  if (!input) {
    throw new Error('file input not rendered');
  }
  return input;
}

const song = () => new File(['abc'], 'song.mp3', { type: 'audio/mpeg' });

describe('FileUploadInput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('passes accept to the file picker', () => {
    renderWithProviders(<Harness accept="audio/*" />);

    expect(fileInput()).toHaveAttribute('accept', 'audio/*');
  });

  test('uploads the picked file and stores the returned location', async () => {
    const upload = vi.fn().mockResolvedValue('http://host/audio/song.mp3');
    const onFormValueChange = vi.fn();
    renderWithProviders(
      <Harness upload={upload} onFormValueChange={onFormValueChange} />,
    );

    const file = song();
    await userEvent.upload(fileInput(), file);

    expect(upload).toHaveBeenCalledExactlyOnceWith(file);
    await waitFor(() =>
      expect(screen.getByRole('textbox')).toHaveValue(
        'http://host/audio/song.mp3',
      ),
    );
    expect(onFormValueChange).toHaveBeenCalledExactlyOnceWith(
      'http://host/audio/song.mp3',
    );
  });

  test('uploads the same file again after it was already picked', async () => {
    const upload = vi.fn().mockResolvedValue('location');
    renderWithProviders(<Harness upload={upload} />);

    const file = song();
    await userEvent.upload(fileInput(), file);
    await userEvent.upload(fileInput(), file);

    expect(upload).toHaveBeenCalledTimes(2);
  });

  test('reports a failed upload once and leaves the field unchanged', async () => {
    const error = new Error('upload failed');
    const upload = vi.fn().mockRejectedValue(error);
    const onUploadError = vi.fn();
    const onFormValueChange = vi.fn();
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    renderWithProviders(
      <Harness
        initialValue="/old/song.mp3"
        upload={upload}
        onUploadError={onUploadError}
        onFormValueChange={onFormValueChange}
      />,
    );

    await userEvent.upload(fileInput(), song());

    await waitFor(() =>
      expect(onUploadError).toHaveBeenCalledExactlyOnceWith(error),
    );
    expect(onFormValueChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('/old/song.mp3');
    expect(consoleError).not.toHaveBeenCalled();
  });

  test('stores a typed location', async () => {
    const onFormValueChange = vi.fn();
    renderWithProviders(<Harness onFormValueChange={onFormValueChange} />);

    await userEvent.type(screen.getByRole('textbox'), '/a');

    expect(onFormValueChange).toHaveBeenLastCalledWith('/a');
    expect(screen.getByRole('textbox')).toHaveValue('/a');
  });
});
