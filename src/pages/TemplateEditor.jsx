// src/pages/TemplateEditor.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import {
    listTemplateFiles,
    getTemplateFile,
    uploadTemplateFile,
    deleteTemplateFile
} from '../api';
import Editor from '@monaco-editor/react';

export default function TemplateEditor() {
    const auth = useAuth();
    const idToken = auth.user?.id_token;

    const [files, setFiles] = useState([]);
    const [selected, setSelected] = useState(null);
    const [content, setContent] = useState('');
    const [fileBlob, setFileBlob] = useState(null);
    const [isJson, setIsJson] = useState(false);
    const [newFile, setNewFile] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (auth.isAuthenticated) {
            loadFiles();
        }
    }, [auth.isAuthenticated]);

    async function loadFiles() {
        setLoading(true);
        try {
            const list = await listTemplateFiles(idToken);
            setFiles(list);
        } catch (e) {
            console.error(e);
            alert('Could not load template files');
        } finally {
            setLoading(false);
        }
    }

    async function selectFile(name) {
        setSelected(name);
        setIsJson(name.toLowerCase().endsWith('.json'));
        setContent('');
        setFileBlob(null);
        setLoading(true);
        try {
            const data = await getTemplateFile(name, idToken);
            if (name.toLowerCase().endsWith('.json')) {
                setContent(data);
            } else {
                setFileBlob(data);
            }
        } catch (e) {
            console.error(e);
            alert('Could not fetch file content');
        } finally {
            setLoading(false);
        }
    }

    async function handleUpload() {
        if (!selected) return;
        setLoading(true);
        try {
            if (isJson) {
                await uploadTemplateFile(selected, content, idToken);
            } else if (fileBlob) {
                await uploadTemplateFile(selected, fileBlob, idToken);
            } else {
                alert('Choose a file first');
                return;
            }
            alert('Upload successful');
            await loadFiles();
        } catch (e) {
            console.error(e);
            alert('Upload failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete() {
        if (!selected || !window.confirm(`Delete ${selected}?`)) return;
        setLoading(true);
        try {
            await deleteTemplateFile(selected, idToken);
            alert('Deleted');
            setSelected(null);
            await loadFiles();
        } catch (e) {
            console.error(e);
            alert('Delete failed');
        } finally {
            setLoading(false);
        }
    }

    async function handleNewFileUpload() {
        if (!newFile) {
            alert('Select a file first');
            return;
        }
        setLoading(true);
        try {
            await uploadTemplateFile(newFile.name, newFile, idToken);
            alert('New file uploaded');
            setNewFile(null);
            await loadFiles();
        } catch (e) {
            console.error(e);
            alert('Upload failed');
        } finally {
            setLoading(false);
        }
    }

    if (!auth.isAuthenticated) {
        return <p>Please sign in to edit templates.</p>;
    }

    return (
        <div style={{padding: 20}}>
            <h1>Template Folder Editor</h1>
            {loading && <p>Loading…</p>}

            <div style={{display: 'flex'}}>
                {/* Left column: new‑file upload + file list */}
                <div style={{width: 250}}>
                    <h3>Upload New File</h3>
                    <input
                        type="file"
                        onChange={e => setNewFile(e.target.files[0])}
                    />
                    <button
                        onClick={handleNewFileUpload}
                        disabled={!newFile}
                        style={{marginLeft: 8}}
                    >
                        Upload
                    </button>

                    <hr/>

                    <ul style={{listStyle: 'none', padding: 0}}>
                        {files.map(name => (
                            <li key={name}>
                                <button
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        background: name === selected ? '#efefef' : 'transparent',
                                        border: 'none',
                                        padding: '4px 8px',
                                    }}
                                    onClick={() => selectFile(name)}
                                >
                                    {name}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Right column: editor for selected file */}
                {selected && (
                    <div style={{marginLeft: 20, flex: 1}}>
                        <h2>{selected}</h2>

                        {isJson ? (
                            <Editor
                                height="400px"
                                defaultLanguage="json"
                                value={content}
                                onChange={value => setContent(value || '')}
                                options={{
                                    minimap: {enabled: false},
                                    tabSize: 2,
                                    formatOnType: true,
                                    formatOnPaste: true
                                }}
                            />
                        ) : (
                            <div>
                                <p>Current file loaded.</p>
                                <input
                                    type="file"
                                    onChange={e => setFileBlob(e.target.files[0])}
                                />
                            </div>
                        )}

                        <div style={{marginTop: 10}}>
                            <button onClick={handleUpload}>Upload / Replace</button>
                            <button onClick={handleDelete} style={{marginLeft: 8}}>
                                Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}