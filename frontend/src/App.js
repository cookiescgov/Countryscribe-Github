import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function App() {
  // --- AUTH STATE ---
  const [username, setUsername] = useState(localStorage.getItem('scribe_user'));
  const [availableUsers, setAvailableUsers] = useState([]);
  const [newUser, setNewUser] = useState('');
  
  // --- APP STATE ---
  const [view, setView] = useState('transcribe');
  const [selectedFile, setSelectedFile] = useState(null);
  const [transcription, setTranscription] = useState([]);
  const [status, setStatus] = useState('Ready');
    const [isLoading, setIsLoading] = useState(false);
    const [modelSize, setModelSize] = useState('large-v3');
    const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'youtube'
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [archives, setArchives] = useState([]);

  const abortControllerRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // --- API INTERCEPTOR ---
  useEffect(() => {
      if (username) {
          axios.defaults.headers.common['X-Department'] = username;
      } else {
          delete axios.defaults.headers.common['X-Department'];
      }
  }, [username]);

  // --- FETCH USERS ---
  useEffect(() => {
      if (!username) {
          axios.get('/api/users').then(res => setAvailableUsers(res.data)).catch(console.error);
      }
  }, [username]);

  // --- AUTH ACTIONS ---
  const performLogin = (userToLogin) => {
      setUsername(userToLogin);
      localStorage.setItem('scribe_user', userToLogin);
  };

  const handleRegister = async (e) => {
      e.preventDefault();
      if (!newUser.trim()) return;
      const formData = new FormData();
      formData.append('username', newUser.trim());
      try {
          await axios.post('/api/register', formData);
          performLogin(newUser.trim());
      } catch (err) {
          alert('Error creating department.');
      }
  };

  const handleLogout = () => {
      setUsername(null);
      localStorage.removeItem('scribe_user');
      setTranscription([]);
      setArchives([]);
      setView('transcribe');
  };



  // --- EXISTING LOGIC ---
  useEffect(() => {
    const hide = localStorage.getItem('hideSplash');
    if (!hide && username) setShowHelpModal(true);
  }, [username]);

  useEffect(() => {
    if (view === 'archive' && username) {
        fetchArchives();
    }
  }, [view, username]);

  const fetchArchives = async () => {
      try {
          const res = await axios.get('/api/archives');
          setArchives(res.data);
      } catch (e) {
          console.error("Failed to load archives");
      }
  };

  const loadArchive = async (filename) => {
      try {
          const res = await axios.get(`/api/archives/${filename}`);
          setTranscription(res.data);
          setView('transcribe');
          setStatus(`Loaded archive: ${filename}`);
      } catch (e) {
          alert("Failed to load archive");
      }
  };

  const deleteArchive = async (filename) => {
      if (!window.confirm(`Delete ${filename}?`)) return;
      try {
          await axios.delete(`/api/archives/${filename}`);
          fetchArchives();
      } catch (e) {
          alert("Failed to delete");
      }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setStatus('Ready to transcribe');
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setStatus('Stopped by user.');
  };

  const pollForCompletion = async (filename) => {
    setStatus('Taking longer than usual... switching to background check mode.');
    
    let initialFilenames = [];
    try {
        const res = await axios.get('/api/archives');
        initialFilenames = res.data.map(a => a.filename);
    } catch(e) {}

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await axios.get('/api/archives');
        const currentFiles = res.data;
        const newFile = currentFiles.find(a => !initialFilenames.includes(a.filename));
        const nameMatch = filename ? currentFiles.find(a => a.filename.includes(filename)) : null;
        const match = newFile || nameMatch;

        if (match) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          await loadArchive(match.filename);
          setIsLoading(false);
          setStatus('Complete! (Retrieved from background)');
        }
      } catch (e) { /* ignore */ }
    }, 5000);
  };

  const handleTranscribe = async () => {
    if (uploadMode === 'file' && !selectedFile) {
      setStatus('Please select an audio/video file first.');
      return;
    }
    if (uploadMode === 'youtube' && !youtubeUrl) {
      setStatus('Please enter a valid YouTube URL.');
      return;
    }

    setIsLoading(true);
    setStatus('Processing Meeting Minutes... (This may take time)');
    setTranscription([]);

    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    formData.append('model_size', modelSize);
    formData.append('meeting_date', meetingDate);

    if (uploadMode === 'file') {
        formData.append('file', selectedFile);
    } else {
        formData.append('youtube_url', youtubeUrl);
    }

    try {
      const response = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: abortControllerRef.current.signal, 
        timeout: 0 
      });
      setTranscription(response.data.transcription);
      setStatus('Transcription Complete.');
      if(view === 'archive') fetchArchives();
      setIsLoading(false);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request cancelled');
        setStatus('Transcription cancelled.');
        setIsLoading(false);
      } else {
        console.error('Error:', error);
        pollForCompletion(selectedFile ? selectedFile.name : null);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };
  
  const copyToClipboard = () => {
    let text;
    if (!showTimestamps) {
        text = transcription.reduce((acc, curr, i) => {
            const spacer = (i + 1) % 5 === 0 ? '\n\n' : ' ';
            return acc + curr.text.trim() + spacer;
        }, "");
    } else {
        text = transcription.map(segment => `[${segment.speaker}] ${segment.text}`).join('\n');
    }
    navigator.clipboard.writeText(text);
    setStatus('Copied to clipboard!');
  };

  const downloadFile = async (endpoint, filename) => {
    if (transcription.length === 0) return;
    try {
      const url = !showTimestamps ? `${endpoint}?clean=true` : endpoint;
      const response = await axios.post(url, transcription, { responseType: 'blob' });
      const fileURL = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = fileURL;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download error:', error);
      setStatus('Error downloading file.');
    }
  };

  const handleClear = () => {
    if (transcription.length > 0 && window.confirm('Are you sure you want to clear this record?')) {
        setTranscription([]);
        setSelectedFile(null);
        setStatus('Ready');
    }
  };

  // --- LOGIN SCREEN ---
  if (!username) {
      return (
        <div className="container vh-100 d-flex justify-content-center align-items-center bg-light">
            <div className="card shadow p-5 border-0" style={{maxWidth: '500px', width: '100%'}}>
                <div className="text-center mb-5">
                    <span style={{fontSize: '4rem'}}>🏛️</span>
                    <h2 className="mt-3 fw-bold text-primary">County Scribe</h2>
                    <p className="text-muted">Select your department to begin.</p>
                </div>
                
                {/* User List */}
                <div className="d-grid gap-3 mb-4">
                    {availableUsers.length > 0 ? (
                        availableUsers.map(u => (
                            <button key={u} className="btn btn-outline-primary btn-lg fw-bold" onClick={() => performLogin(u)}>
                                👤 {u}
                            </button>
                        ))
                    ) : (
                        <p className="text-center text-muted small">No accounts found. Create one below!</p>
                    )}
                </div>

                <hr className="my-4"/>

                {/* Create New */}
                <form onSubmit={handleRegister}>
                    <label className="form-label small fw-bold text-muted">Create New Account</label>
                    <div className="input-group">
                        <input 
                            type="text" 
                            className="form-control"
                            placeholder="Department Name..." 
                            value={newUser}
                            onChange={(e) => setNewUser(e.target.value)}
                            required
                        />
                        <button className="btn btn-success" type="submit">Create</button>
                    </div>
                </form>
            </div>
        </div>
      );
  }

  // --- MAIN APP ---
  return (
    <div className="container-fluid vh-100 d-flex flex-column p-0">
      <nav className="navbar navbar-dark bg-primary px-4 shadow-sm" style={{ backgroundColor: '#0d47a1' }}>
        <span className="navbar-brand mb-0 h1 d-flex align-items-center">
          <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>🏛️</span>
          County Scribe <span className="text-white-50 fs-6 ms-2">| Official Meeting Transcription</span>
        </span>
        <div className="d-flex align-items-center">
            <span className="text-white small me-3 bg-white bg-opacity-25 px-2 py-1 rounded">👤 {username}</span>
            <button 
                className={`btn btn-sm me-2 ${view === 'transcribe' ? 'btn-light' : 'btn-outline-light'}`}
                onClick={() => setView('transcribe')}
            >
                📝 New Transcription
            </button>
            <button 
                className={`btn btn-sm me-2 ${view === 'archive' ? 'btn-light' : 'btn-outline-light'}`}
                onClick={() => setView('archive')}
            >
                🗄️ Archives
            </button>
            <button className="btn btn-sm btn-outline-warning me-2" onClick={() => window.open('https://notebooklm.google.com/', '_blank')}>
                📓 NotebookLM
            </button>
            <button className="btn btn-sm btn-info me-2 text-white" onClick={() => setShowHelpModal(true)}>
                ❓ Need Help?
            </button>
            <button className="btn btn-sm btn-outline-light" onClick={handleLogout}>
                Log Out
            </button>
        </div>
      </nav>

      {/* BODY */}
      <div className="row flex-grow-1 g-0">
        {view === 'transcribe' ? (
        <>
            <div className="col-md-3 bg-light border-end p-4">
            <h5 className="text-secondary mb-4">Session Controls</h5>
            
            <div className="mb-4">
                <label className="form-label fw-bold small text-uppercase text-muted">📅 Meeting Date</label>
                <input 
                    type="date" 
                    className="form-control"
                    value={meetingDate} 
                    onChange={(e) => setMeetingDate(e.target.value)}
                    disabled={isLoading}
                />
                <div className="form-text small">Used for sorting in Archives.</div>
            </div>

            <div className="mb-4">
                <label className="form-label fw-bold small text-uppercase text-muted">1. Accuracy Level</label>
                <select className="form-select" value={modelSize} onChange={(e) => setModelSize(e.target.value)} disabled={isLoading}>
                <option value="large-v3">✨ Official Record (Best Accuracy)</option>
                <option value="large-v2">Large V2 (High Accuracy)</option>
                <option value="medium.en">Medium (Balanced)</option>
                <option value="small.en">Small (Fast / Local GPU)</option>
                </select>
            </div>

            <div className="mb-4">
                <label className="form-label fw-bold small text-uppercase text-muted">2. Source Material</label>
                <ul className="nav nav-tabs nav-fill mb-3 small">
                    <li className="nav-item">
                        <button className={`nav-link ${uploadMode === 'file' ? 'active fw-bold' : ''}`} onClick={() => setUploadMode('file')} style={{cursor: 'pointer'}}>
                            📁 File Upload
                        </button>
                    </li>
                    <li className="nav-item">
                        <button className={`nav-link ${uploadMode === 'youtube' ? 'active fw-bold' : ''}`} onClick={() => setUploadMode('youtube')} style={{cursor: 'pointer'}}>
                            ▶️ YouTube
                        </button>
                    </li>
                </ul>

                {uploadMode === 'file' ? (
                    <div>
                        <input type="file" className="form-control" onChange={handleFileChange} accept="audio/*,video/*" disabled={isLoading} />
                        {selectedFile && <div className="form-text mt-2 text-truncate">Selected: {selectedFile.name}</div>}
                    </div>
                ) : (
                    <div>
                        <input type="text" className="form-control" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} disabled={isLoading} />
                        <div className="form-text mt-2">Paste the full video link here.</div>
                    </div>
                )}
            </div>

            <div className="d-grid gap-2 mb-4">
                {!isLoading ? (
                <button className="btn btn-primary py-2 fw-bold" onClick={handleTranscribe} disabled={(uploadMode === 'file' && !selectedFile) || (uploadMode === 'youtube' && !youtubeUrl)} style={{ backgroundColor: '#0d47a1' }}>
                    Start Transcription
                </button>
                ) : (
                <button className="btn btn-danger py-2 fw-bold" onClick={handleStop}>🛑 STOP PROCESSING</button>
                )}
                {isLoading && (
                <div className="text-center mt-2">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="small text-muted mt-1">Analyzing Audio...</p>
                </div>
                )}
            </div>
            <div className="alert alert-secondary small"><strong>Status:</strong> {status}</div>
            </div>

            <div className="col-md-9 p-0 d-flex flex-column bg-white">
            {/* Toolbar */}
            <div className="bg-light border-bottom p-3 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                    <h5 className="m-0 text-dark me-3">Official Record</h5>
                    <div className="form-check form-switch me-3">
                        <input className="form-check-input" type="checkbox" id="timestampToggle" checked={showTimestamps} onChange={(e) => setShowTimestamps(e.target.checked)} />
                        <label className="form-check-label small fw-bold text-muted" htmlFor="timestampToggle">Show Details (Timestamps)</label>
                    </div>
                    {transcription.length > 0 && (
                        <button className="btn btn-danger btn-sm" onClick={handleClear}>🗑️ Clear Record</button>
                    )}
                </div>
                <div className="btn-group">
                    <button className="btn btn-outline-secondary" onClick={copyToClipboard} disabled={transcription.length === 0}>Copy Text</button>
                    <button className="btn btn-outline-danger" onClick={() => downloadFile('/api/download-pdf', 'Minutes.pdf')} disabled={transcription.length === 0}>Export PDF</button>
                    <button className="btn btn-outline-primary" onClick={() => downloadFile('/api/download-docx', 'Minutes.docx')} disabled={transcription.length === 0}>Export Word</button>
                </div>
            </div>

            <div className="flex-grow-1 p-5" style={{ overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                {transcription.length > 0 ? (
                <div className="paper shadow-sm bg-white p-5" style={{ maxWidth: '900px', margin: '0 auto', minHeight: '100%' }}>
                    {!showTimestamps ? (
                        <div className="draft-view">
                            <h3 className="text-center mb-4 text-uppercase border-bottom pb-2">Meeting Minutes Draft</h3>
                            <div className="lead text-dark" style={{ lineHeight: '1.8', whiteSpace: 'pre-wrap', fontFamily: 'Georgia, serif' }}>
                                {transcription.reduce((text, segment, index) => {
                                    const spacer = (index + 1) % 5 === 0 ? '\n\n' : ' ';
                                    return text + segment.text.trim() + spacer;
                                }, "")}
                            </div>
                            <div className="mt-5 text-muted small border-top pt-2">* This draft was auto-generated. Please proofread for accuracy.</div>
                        </div>
                    ) : (
                        transcription.map((segment, index) => (
                        <div key={index} className="mb-4">
                            <div className="d-flex align-items-baseline mb-1">
                            <strong className="text-primary me-2" style={{ color: '#0d47a1' }}>{segment.speaker || 'Unknown Member'}</strong>
                            <span className="text-muted small font-monospace">[{segment.start} - {segment.end}]</span>
                            </div>
                            <p className="lead fs-6 text-dark" style={{ lineHeight: '1.6' }}>{segment.text}</p>
                        </div>
                        ))
                    )}
                </div>
                ) : (
                <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted opacity-50">
                    <span style={{ fontSize: '4rem' }}>📄</span>
                    <p className="mt-3">Ready to transcribe. Upload a file to begin.</p>
                </div>
                )}
            </div>
            </div>
        </>
        ) : (
            <div className="col-12 p-5 bg-light h-100" style={{ overflowY: 'auto' }}>
                <div className="container bg-white p-5 shadow-sm rounded">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h2>🗄️ {username}'s Archives</h2>
                        <span className="badge bg-secondary">📅 Retention Policy: 180 Days</span>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-hover">
                            <thead className="table-light">
                                <tr>
                                    <th>Meeting Date</th>
                                    <th>Processed</th>
                                    <th>Filename</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {archives.length === 0 ? (
                                    <tr><td colSpan="4" className="text-center py-4">No archives found.</td></tr>
                                ) : (
                                    archives.map((file, idx) => (
                                        <tr key={idx}>
                                            <td className="fw-bold text-primary">{file.meeting_date}</td>
                                            <td className="small text-muted">{file.created}</td>
                                            <td className="font-monospace small text-muted text-truncate" style={{maxWidth: '200px'}} title={file.filename}>{file.filename}</td>
                                            <td>
                                                <button className="btn btn-sm btn-primary me-2" onClick={() => loadArchive(file.filename)}>Open</button>
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteArchive(file.filename)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </div>

      {showHelpModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content shadow-lg border-0">
                    <div className="modal-header bg-primary text-white">
                        <h5 className="modal-title">🏛️ County Scribe: Complete User Guide</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={() => setShowHelpModal(false)}></button>
                    </div>
                    <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Step 1: Setting up the Meeting</h6>
                            <ul className="small text-muted">
                                <li><strong>📅 Meeting Date:</strong> First, pick the actual date the meeting happened using the date picker in the sidebar. This ensures your archives are sorted correctly.</li>
                                <li><strong>📂 Source Material:</strong> You can either upload a file (drag & drop) OR switch the tab to paste a <strong>YouTube Link</strong> if the meeting was streamed.</li>
                            </ul>
                        </section>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Step 2: Start Transcription</h6>
                            <p className="small text-muted">Click <strong>Start Transcription</strong>. A typical 90-minute meeting takes about 10-15 minutes to process.<br/><i>Note: The system works in the background even if you close the tab! Check Archives later.</i></p>
                        </section>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Step 3: Proofreading</h6>
                            <p className="small text-muted">Use the <strong>"Show Details (Timestamps)"</strong> toggle at the top if you need to see exactly when someone spoke. By default, it shows a clean, readable draft.</p>
                        </section>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Step 4: Creating Minutes (NotebookLM)</h6>
                            <ol className="small text-muted">
                                <li>Ensure you are in the default clean view and click <strong>"Copy Text"</strong>.</li>
                                <li>Click the <strong>"NotebookLM"</strong> button at the top to open Google's website.</li>
                                <li>In NotebookLM, paste your text as a new <strong>Source</strong>.</li>
                                <li>On the right side, click <strong>"Create your own"</strong> in the <strong>Reports</strong> section (between Audio Overview and Infographics).</li>
                                <li>Paste one of these commands below:</li>
                            </ol>
                            <div className="card mb-3">
                                <div className="card-header bg-light fw-bold small text-dark py-1">Option 1: Standard Minutes</div>
                                <div className="card-body p-2 bg-white small font-monospace text-dark user-select-all">Using this transcript, write a formal set of meeting minutes. Include the Call to Order, a summary of every motion made, and the time of adjournment.</div>
                            </div>
                            <div className="card">
                                <div className="card-header bg-light fw-bold small text-dark py-1">Option 2: Starke County Official Format</div>
                                <div className="card-body p-2 bg-white small font-monospace text-dark user-select-all" style={{whiteSpace: 'pre-wrap', fontSize: '0.7rem'}}>
Objective: Transform the provided notes into formal Meeting Minutes following the "Starke County Board of Commissioners" style.
Formatting Rules:
Header: Center-align the Board name, followed by "MEETING MINUTES." Include Date, Location, and Time clearly at the top left.
Structure: Start with a Call to Order paragraph mentioning the Pledge of Allegiance. Use a Roll Call section divided into "Present," "Also Present," and "Absent."
Sections: Use centered dashed lines (-------------------------) to separate sections. Label main topics with bold Roman Numerals (e.g., I. EMS MONTHLY REPORT).
Content Style: Use bullet points for status updates and reports.
For official actions, use the exact format:
MOTION: [Commissioner Name] moved to [Action], seconded by [Commissioner Name].
RESULT: [e.g., Passed unanimously (2-0)].
Closing: End with an ADJOURNMENT section and a signature block at the bottom for the President, Vice-President, Member, and Auditor.
Tone: Maintain a neutral, professional, and objective government-transcription tone. Ensure all figures, dates, and names are captured with 100% accuracy.
                                </div>
                            </div>
                        </section>
                        <div className="alert alert-warning py-2 small mb-0"><strong>⚠️ System Limit:</strong> Only one meeting can be processed at a time. If you see a "System Busy" message, please wait ~20 minutes.</div>
                    </div>
                    <div className="modal-footer bg-light justify-content-between">
                        <div className="form-check">
                            <input className="form-check-input" type="checkbox" id="hideSplash" onChange={(e) => {
                                if(e.target.checked) localStorage.setItem('hideSplash', 'true');
                                else localStorage.removeItem('hideSplash');
                            }} />
                            <label className="form-check-label small" htmlFor="hideSplash">Don't show this guide on startup again</label>
                        </div>
                        <button className="btn btn-primary px-4 fw-bold" onClick={() => setShowHelpModal(false)}>I'm Ready!</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;