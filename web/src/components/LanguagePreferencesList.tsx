import languages from '@cospired/i18n-iso-languages';
import en from '@cospired/i18n-iso-languages/langs/en.json';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Autocomplete, Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';

// Initialize the languages database with English names
languages.registerLocale(en);

export interface LanguagePreference {
    iso6391: string;
    displayName: string;
}

interface LanguagePreferencesListProps {
    preferences: LanguagePreference[];
    onChange: (preferences: LanguagePreference[]) => void;
}

// Get all available languages as a map of ISO 639-1 codes to display names
const languageOptions = Object.entries(languages.getNames('en')).map(([code, name]) => ({
    iso6391: code,
    displayName: name
}));

export function LanguagePreferencesList({ preferences, onChange }: LanguagePreferencesListProps) {
    const handleAdd = () => {
        onChange([...preferences, { iso6391: 'en', displayName: 'English' }]);
    };

    const handleDelete = (index: number) => {
        if (preferences.length > 1) {
            onChange(preferences.filter((_, i) => i !== index));
        }
    };

    const handleChange = (index: number, value: LanguagePreference | null) => {
        if (!value) return;
        const newPreferences = [...preferences];
        newPreferences[index] = value;
        onChange(newPreferences);
    };

    return (
        <Box>
            <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Audio Language Preferences</Typography>

            <Typography variant="subtitle2" sx={{ mb: 1, fontStyle: 'italic' }}>
                In order of priority
            </Typography>
            <Stack spacing={2}>
                {preferences.map((pref, index) => (
                    <Stack key={index} direction="row" spacing={2} alignItems="center">
                        <Autocomplete
                            fullWidth
                            value={pref}
                            onChange={(_, newValue) => handleChange(index, newValue)}
                            options={languageOptions}
                            getOptionLabel={(option) => option.displayName}
                            isOptionEqualToValue={(option, value) => option.iso6391 === value.iso6391}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Language"
                                    variant="outlined"
                                />
                            )}
                        />
                        {preferences.length > 1 && (
                            <IconButton
                                onClick={() => handleDelete(index)}
                                size="small"
                                aria-label="Delete language preference"
                            >
                                <DeleteIcon />
                            </IconButton>
                        )}
                    </Stack>
                ))}

            </Stack>
            <Button
                startIcon={<AddIcon />}
                variant='outlined'
                onClick={handleAdd}
                sx={{ width: 'fit-content', my: 1 }}
            >
                Add Language
            </Button>
        </Box>
    );
} 