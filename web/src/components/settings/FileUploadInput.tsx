import CloudUpload from '@mui/icons-material/CloudUpload';
import type { FormControlProps } from '@mui/material/FormControl';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import type { OutlinedInputProps } from '@mui/material/OutlinedInput';
import OutlinedInput from '@mui/material/OutlinedInput';
import { styled } from '@mui/material/styles';
import type { ChangeEvent } from 'react';
import React, { useCallback, useRef } from 'react';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export type FileUploadInputProps = {
  FormControlProps?: FormControlProps;
  InputProps?: OutlinedInputProps;
  label: string;
  value: string;
  /** File types the picker offers, in the `<input accept>` format. */
  accept: string;
  /** Uploads the picked file and resolves to the value the field stores. */
  upload: (file: File) => Promise<string>;
  onFormValueChange: (value: string) => void;
  onUploadError: (error: unknown) => void;
  children?: React.ReactNode;
};

/**
 * A text field for a file location, with a button that uploads a file and
 * fills the field with the stored location.
 */
export function FileUploadInput({
  FormControlProps,
  InputProps,
  label,
  value,
  accept,
  upload,
  onFormValueChange: onChange,
  onUploadError,
  children,
}: FileUploadInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

      upload(file)
        .then((location) => {
          onChange(location);
        })
        .catch(onUploadError);
    },
    [upload, onChange, onUploadError],
  );

  const onLocationChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  return (
    <FormControl {...(FormControlProps ?? {})}>
      <InputLabel>{label}</InputLabel>
      <OutlinedInput
        label={label}
        value={value}
        onChange={onLocationChange}
        endAdornment={
          <InputAdornment position="end">
            <IconButton
              component="label"
              onClick={() => {
                // Clear the picker so choosing the same file again re-uploads it.
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              <CloudUpload />
              <VisuallyHiddenInput
                ref={fileInputRef}
                onChange={handleFileUpload}
                type="file"
                accept={accept}
              />
            </IconButton>
          </InputAdornment>
        }
        {...(InputProps ?? {})}
      />
      {children}
    </FormControl>
  );
}
