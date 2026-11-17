import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../generated/sdk.gen.ts';

const mocks = vi.hoisted(() => ({
  uploadImage: vi.fn(),
}));

vi.mock('../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  postApiUploadImage: mocks.uploadImage,
}));

const { renderWithProviders, screen, userEvent, waitFor } = await import(
  '../../test/utils.tsx'
);
const { ImageUploadInput } = await import('./ImageUploadInput.tsx');

function fileInput() {
  const input = document.querySelector<HTMLInputElement>('input[type=file]');
  if (!input) {
    throw new Error('file input not rendered');
  }
  return input;
}

describe('ImageUploadInput', () => {
  beforeEach(() => {
    mocks.uploadImage.mockReset();
  });

  test('offers image files only', () => {
    renderWithProviders(
      <ImageUploadInput
        label="Image URL"
        value=""
        fileRenamer={(file) => file.name}
        onFormValueChange={vi.fn()}
        onUploadError={vi.fn()}
      />,
    );

    expect(fileInput()).toHaveAttribute('accept', 'image/*');
  });

  test('uploads the renamed image and stores the returned URL', async () => {
    mocks.uploadImage.mockResolvedValue({
      data: { fileUrl: 'http://host/images/channel_1.png' },
    });
    const onFormValueChange = vi.fn();
    renderWithProviders(
      <ImageUploadInput
        label="Image URL"
        value=""
        fileRenamer={() => 'channel_1.png'}
        onFormValueChange={onFormValueChange}
        onUploadError={vi.fn()}
      />,
    );

    await userEvent.upload(
      fileInput(),
      new File(['png'], 'original.png', { type: 'image/png' }),
    );

    await waitFor(() =>
      expect(onFormValueChange).toHaveBeenCalledExactlyOnceWith(
        'http://host/images/channel_1.png',
      ),
    );
    expect(mocks.uploadImage).toHaveBeenCalledOnce();
    const [{ body, throwOnError }] = mocks.uploadImage.mock.calls[0] as [
      { body: { file: File }; throwOnError: boolean },
    ];
    expect(throwOnError).toBe(true);
    expect(body.file.name).toBe('channel_1.png');
    expect(body.file.type).toBe('image/png');
    expect(await body.file.text()).toBe('png');
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  test('reports a failed upload', async () => {
    const error = new Error('upload failed');
    mocks.uploadImage.mockRejectedValue(error);
    const onUploadError = vi.fn();
    const onFormValueChange = vi.fn();
    renderWithProviders(
      <ImageUploadInput
        label="Image URL"
        value=""
        fileRenamer={(file) => file.name}
        onFormValueChange={onFormValueChange}
        onUploadError={onUploadError}
      />,
    );

    await userEvent.upload(
      fileInput(),
      new File(['png'], 'a.png', { type: 'image/png' }),
    );

    await waitFor(() =>
      expect(onUploadError).toHaveBeenCalledExactlyOnceWith(error),
    );
    expect(onFormValueChange).not.toHaveBeenCalled();
  });
});
