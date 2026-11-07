import { useCallback } from 'react';
import { postApiUploadImage } from '../../generated/sdk.gen.ts';
import type { FileUploadInputProps } from './FileUploadInput.tsx';
import { FileUploadInput } from './FileUploadInput.tsx';

type Props = Omit<FileUploadInputProps, 'accept' | 'upload'> & {
  fileRenamer: (file: File) => string;
};

export function ImageUploadInput({ fileRenamer, ...props }: Props) {
  const upload = useCallback(
    async (file: File) => {
      const renamedFile = new File(
        [file.slice(0, file.size, file.type)],
        fileRenamer(file),
        { type: file.type },
      );
      const response = await postApiUploadImage({
        body: { file: renamedFile },
        throwOnError: true,
      });
      return response.data.fileUrl;
    },
    [fileRenamer],
  );

  return <FileUploadInput {...props} accept="image/*" upload={upload} />;
}
