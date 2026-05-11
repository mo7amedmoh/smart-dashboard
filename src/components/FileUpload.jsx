import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import * as XLSX from 'xlsx';

const FileUpload = ({ 
  onDataProcessed, 
  title = "Upload Data", 
  description = "Upload your Excel file to generate the dashboard naturally." 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const processExcel = async (file) => {
    setLoading(true);
    setFileName(file.name);
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Assuming the first sheet for NUR or looking for a specific sheet name
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
        
        // Pass data up
        onDataProcessed(jsonData);
    } catch (err) {
        console.error("Error parsing excel:", err);
        alert("Failed to parse Excel file. Please ensure it's a valid format.");
        setFileName('');
    } finally {
        setLoading(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processExcel(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processExcel(e.target.files[0]);
    }
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setFileName('');
    onDataProcessed(null);
  };

  return (
    <div 
        className={`upload-area glass-panel ${isDragging ? 'drag-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload').click()}
    >
      <input 
        id="file-upload" 
        type="file" 
        accept=".xlsx, .xls, .csv" 
        style={{ display: 'none' }} 
        onChange={handleChange}
      />
      
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '40px', height: '40px', border: '4px solid rgba(var(--accent-rgb), 0.3)', borderTop: '4px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p>Processing Data...</p>
        </div>
      ) : fileName ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={48} color="var(--success)" />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: '500' }}>{fileName}</span>
                <button onClick={clearFile} style={{ background: 'transparent', padding: '4px', borderRadius: '50%', color: 'var(--text-secondary)' }} className="btn-secondary">
                    <X size={16} />
                </button>
            </div>
            <p style={{ color: 'var(--text-secondary)' }}>Click or drag a new file to replace</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ background: 'var(--accent-bg)', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
            <Upload size={32} color="var(--accent)" />
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{title}</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', margin: '0 auto' }}>
            {description}
          </p>
        </div>
      )}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default FileUpload;
