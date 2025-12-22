"use client";

import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import Dropzone from 'dropzone';

function StartSessionFromUpload({ onChange }) {
    const dropzoneRef = useRef(null);
    const dropzoneInstance = useRef(null);
    const [uploadedFile, setUploadedFile] = useState(null);

    useEffect(() => {
        if (dropzoneRef.current && !dropzoneInstance.current) {
            dropzoneInstance.current = new Dropzone(dropzoneRef.current, {
                url: '/',
                autoProcessQueue: false,
                acceptedFiles: '.edi,.edifact,.txt',
                maxFiles: 1,
                dictDefaultMessage: '',
                previewsContainer: false,
                clickable: true
            });

            dropzoneInstance.current.on('addedfile', async (file) => {
                setUploadedFile(file);
                onChange && onChange(file);
                dropzoneInstance.current.removeFile(file);
            });
        }

        return () => {
            if (dropzoneInstance.current) {
                dropzoneInstance.current.destroy();
                dropzoneInstance.current = null;
            }
        };
    }, [onChange]);

    return (
        <Box sx={{ p: 1, '& .dz-default.dz-message': { display: 'none' } }}>
            <Box
                ref={dropzoneRef}
                className="dropzone"
                sx={{
                    width: '100%',
                    minHeight: '300px',
                    border: '2px dashed #ccc',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'background.default',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                        backgroundColor: 'background.paper',
                        borderColor: '#999'
                    }
                }}
            >
                <Box sx={{ textAlign: 'center', p: 3 }}>
                    <Typography variant="h6" color="textSecondary" gutterBottom>
                        📁 Drag & Drop EDIFACT File
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Supported formats: .edi, .edifact, .txt
                    </Typography>
                    {uploadedFile && (
                        <Typography variant="body2" color="primary" sx={{ mt: 2 }}>
                            ✓ {uploadedFile.name}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Box>
    );
}

export default StartSessionFromUpload;
