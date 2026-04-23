import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function formatBytes(n) {
  if (!n && n !== 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatSeconds(s) {
  if (s === null || s === undefined) return '—';
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const ERROR_HINTS = {
  CUDA_OOM: 'GPU ran out of memory. Try a smaller model (Medium or Small) or wait for the other job to finish.',
  FFMPEG_FAIL: 'The audio file could not be decoded. It may be corrupt or use an unsupported codec.',
  YT_DOWNLOAD_FAIL: 'YouTube download failed. The video may be private, region-locked, or rate-limited. Try again in a few minutes.',
  MODEL_LOAD_FAIL: 'Could not load the transcription model. Check disk space and network access.',
  FILE_NOT_FOUND: 'A file disappeared during processing. Try again.',
  CANCELLED: 'The job was cancelled.',
  UNKNOWN: 'An unexpected error occurred. See details below.',
};

function JobStatusPanel({ status, job, jobError, showErrorDetail, setShowErrorDetail }) {
  // Failure state
  if (jobError) {
    const code = jobError.error_code || 'UNKNOWN';
    const hint = ERROR_HINTS[code] || ERROR_HINTS.UNKNOWN;
    const copyDetails = () => {
      const blob = `County Scribe error
Code: ${code}
Message: ${jobError.error || ''}
Phase: ${jobError.phase || ''}
File: ${jobError.filename || ''}
Segments done: ${jobError.segments_done || 0}
Elapsed: ${jobError.elapsed_seconds || 0}s

--- traceback ---
${jobError.error_detail || '(none)'}`;
      navigator.clipboard.writeText(blob);
    };
    return (
      <div className="alert alert-danger small">
        <div className="fw-bold mb-1">❌ Transcription failed</div>
        <div className="mb-1"><code>{code}</code> — {hint}</div>
        {jobError.error && <div className="text-muted mb-2" style={{wordBreak: 'break-word'}}>{jobError.error}</div>}
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-danger" onClick={copyDetails}>📋 Copy details</button>
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowErrorDetail(v => !v)}>
            {showErrorDetail ? 'Hide' : 'Show'} traceback
          </button>
        </div>
        {showErrorDetail && jobError.error_detail && (
          <pre className="mt-2 p-2 bg-light border small" style={{maxHeight: '160px', overflow: 'auto', fontSize: '0.7rem'}}>
            {jobError.error_detail}
          </pre>
        )}
      </div>
    );
  }

  // No active job: plain status line
  if (!job) {
    return <div className="alert alert-secondary small"><strong>Status:</strong> {status}</div>;
  }

  const pct = Math.round((job.progress || 0) * 100);
  const queued = job.state === 'queued';
  const hung = job.possibly_hung && !['complete', 'failed', 'cancelled'].includes(job.state);

  return (
    <div className={`alert ${hung ? 'alert-warning' : 'alert-info'} small`}>
      <div className="d-flex justify-content-between align-items-baseline mb-1">
        <span className="fw-bold">{job.phase}</span>
        <span className="text-muted">{pct}%</span>
      </div>

      <div className="progress mb-2" style={{height: '10px'}}>
        <div
          className={`progress-bar ${queued ? 'bg-secondary' : 'bg-primary'} ${job.state !== 'complete' ? 'progress-bar-striped progress-bar-animated' : ''}`}
          role="progressbar"
          style={{width: `${Math.max(pct, queued ? 6 : 2)}%`}}
        />
      </div>

      {queued && job.queue_position > 1 && (
        <div className="small mb-1">⏳ Queued — {job.queue_position - 1} ahead of you.</div>
      )}

      {job.message && <div className="text-muted small mb-1" style={{wordBreak: 'break-word'}}>{job.message}</div>}

      <div className="d-flex justify-content-between text-muted" style={{fontSize: '0.75rem'}}>
        <span>Elapsed: {formatSeconds(job.elapsed_seconds)}</span>
        <span>ETA: {formatSeconds(job.eta_seconds)}</span>
      </div>

      {hung && (
        <div className="mt-2 small text-danger fw-bold">
          ⚠ No progress for {formatSeconds(job.seconds_since_heartbeat)} — job may be stuck. You can Stop and retry.
        </div>
      )}
    </div>
  );
}

function SettingsModal({ onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [cfg, setCfg] = useState({
    smtp_host: '', smtp_port: 25, smtp_user: '', smtp_pass: '',
    smtp_from: '', smtp_use_tls: false, app_base_url: '',
  });
  const [passSet, setPassSet] = useState(false);
  const [testTo, setTestTo] = useState('');
  const [saveMsg, setSaveMsg] = useState(null);
  const [testMsg, setTestMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get('/api/settings/smtp').then(res => {
      const d = res.data || {};
      setCfg(c => ({ ...c, ...d, smtp_pass: '' }));
      setPassSet(!!d.smtp_pass_set);
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const update = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setBusy(true);
    setSaveMsg(null);
    try {
      const payload = { ...cfg };
      // If user didn't type a new password, don't overwrite the existing one
      if (payload.smtp_pass === '') delete payload.smtp_pass;
      const res = await axios.put('/api/settings/smtp', payload);
      setPassSet(!!res.data.smtp_pass_set);
      setCfg(c => ({ ...c, ...res.data, smtp_pass: '' }));
      setSaveMsg({ ok: true, text: 'Settings saved.' });
    } catch (e) {
      const detail = e.response && e.response.data && e.response.data.detail;
      setSaveMsg({ ok: false, text: detail || 'Save failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTestMsg(null);
    const to = (testTo || '').trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      setTestMsg({ ok: false, text: 'Enter a valid test recipient email first.' });
      return;
    }
    setBusy(true);
    try {
      const res = await axios.post('/api/settings/smtp/test', { to });
      setTestMsg({ ok: true, text: res.data.message || 'Test email sent.' });
    } catch (e) {
      const detail = e.response && e.response.data && e.response.data.detail;
      setTestMsg({ ok: false, text: detail || 'Test failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title">⚙️ Server Settings</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>
          <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {!loaded ? (
              <div className="text-center py-4"><div className="spinner-border" /></div>
            ) : (
              <>
                <h6 className="fw-bold text-primary mb-3">Email (SMTP)</h6>
                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label small fw-bold">SMTP Host</label>
                    <input className="form-control" value={cfg.smtp_host || ''}
                           onChange={e => update('smtp_host', e.target.value)}
                           placeholder="mail.yourdomain.local" />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-bold">Port</label>
                    <input type="number" className="form-control" value={cfg.smtp_port || 25}
                           onChange={e => update('smtp_port', parseInt(e.target.value, 10) || 25)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Username (optional)</label>
                    <input className="form-control" value={cfg.smtp_user || ''}
                           onChange={e => update('smtp_user', e.target.value)}
                           placeholder="leave blank for anonymous relay" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-bold">Password (optional)</label>
                    <input type="password" className="form-control" value={cfg.smtp_pass || ''}
                           onChange={e => update('smtp_pass', e.target.value)}
                           placeholder={passSet ? '•••••••• (saved — leave blank to keep)' : 'leave blank for anonymous'} />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-bold">From Address</label>
                    <input className="form-control" value={cfg.smtp_from || ''}
                           onChange={e => update('smtp_from', e.target.value)}
                           placeholder="County Scribe <noreply@yourdomain.local>" />
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input type="checkbox" className="form-check-input" id="smtpTls"
                             checked={!!cfg.smtp_use_tls}
                             onChange={e => update('smtp_use_tls', e.target.checked)} />
                      <label className="form-check-label small" htmlFor="smtpTls">
                        Use STARTTLS (usually off for internal Exchange on port 25)
                      </label>
                    </div>
                  </div>
                </div>

                <hr className="my-4" />

                <h6 className="fw-bold text-primary mb-3">App</h6>
                <label className="form-label small fw-bold">App Base URL (for links in notification emails)</label>
                <input className="form-control" value={cfg.app_base_url || ''}
                       onChange={e => update('app_base_url', e.target.value)}
                       placeholder="http://your-server:8000" />

                <hr className="my-4" />

                <h6 className="fw-bold text-primary mb-3">Send a test email</h6>
                <div className="input-group">
                  <input type="email" className="form-control" value={testTo}
                         onChange={e => setTestTo(e.target.value)}
                         placeholder="recipient@example.com" />
                  <button className="btn btn-outline-primary" onClick={handleTest} disabled={busy}>
                    📧 Send Test
                  </button>
                </div>
                <div className="form-text small">Uses the settings shown above (save first if you changed them).</div>

                {saveMsg && (
                  <div className={`alert mt-3 small ${saveMsg.ok ? 'alert-success' : 'alert-danger'}`}>
                    {saveMsg.text}
                  </div>
                )}
                {testMsg && (
                  <div className={`alert mt-3 small ${testMsg.ok ? 'alert-success' : 'alert-danger'}`}>
                    {testMsg.text}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="modal-footer bg-light">
            <button className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Close</button>
            <button className="btn btn-primary fw-bold" onClick={handleSave} disabled={busy || !loaded}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [job, setJob] = useState(null);              // current job status from backend
  const [jobError, setJobError] = useState(null);    // last terminal error
  const [showErrorDetail, setShowErrorDetail] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // {loaded, total, pct}
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);      // checkbox state
  const [savedEmail, setSavedEmail] = useState(null);         // department email on file
  const [emailInput, setEmailInput] = useState('');           // entered/confirmed email

  const pollIntervalRef = useRef(null);
  const currentJobIdRef = useRef(null);
  const segmentOffsetRef = useRef(0);

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

  // --- LOAD DEPARTMENT EMAIL ON LOGIN ---
  useEffect(() => {
      if (!username) return;
      axios.get('/api/me/email').then(res => {
          const e = res.data && res.data.email;
          setSavedEmail(e || null);
          setEmailInput(e || '');
      }).catch(() => {});
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
      localStorage.removeItem('scribe_active_job');
      stopPolling();
      currentJobIdRef.current = null;
      setJob(null);
      setJobError(null);
      setTranscription([]);
      setArchives([]);
      setView('transcribe');
  };

  const deleteDepartment = async (deptName) => {
      if (!window.confirm(`Permanently remove the ${deptName} department from the list?`)) return;
      try {
          await axios.delete(`/api/users/${deptName}`);
          // Force a list refresh
          const res = await axios.get('/api/users');
          setAvailableUsers(res.data);
      } catch (e) {
          alert("Failed to delete department");
      }
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

  const renameArchive = async (filename) => {
      const suggested = filename.replace(/\.json$/i, '');
      const raw = window.prompt('New name for this archive:', suggested);
      if (raw === null) return;
      const trimmed = raw.trim();
      if (!trimmed || trimmed === suggested) return;
      try {
          await axios.patch(`/api/archives/${filename}`, { new_name: trimmed });
          fetchArchives();
      } catch (e) {
          const detail = e.response && e.response.data && e.response.data.detail;
          alert(detail || 'Rename failed');
      }
  };

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setStatus('Ready to transcribe');
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleStop = async () => {
    const jid = currentJobIdRef.current;
    if (jid) {
      try {
        await axios.delete(`/api/jobs/${jid}`);
        setStatus('Cancellation requested…');
      } catch (e) {
        setStatus('Failed to request cancel.');
      }
    } else {
      setIsLoading(false);
      setStatus('Stopped.');
    }
  };

  const fetchNewSegments = async (jobId) => {
    try {
      const after = segmentOffsetRef.current;
      const res = await axios.get(`/api/jobs/${jobId}/segments`, { params: { after } });
      const { total, segments: newSegs } = res.data;
      if (newSegs && newSegs.length > 0) {
        setTranscription(prev => [...prev, ...newSegs]);
        segmentOffsetRef.current = total;
      }
    } catch (e) { /* ignore */ }
  };

  const finishJob = (terminalState) => {
    stopPolling();
    currentJobIdRef.current = null;
    localStorage.removeItem('scribe_active_job');
    if (terminalState !== 'complete') segmentOffsetRef.current = 0;
    setIsLoading(false);
  };

  const pollJob = (jobId) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        // Fetch new segments first so UI keeps up even if state changes this tick
        await fetchNewSegments(jobId);

        const res = await axios.get(`/api/jobs/${jobId}`);
        const j = res.data;
        setJob(j);

        if (j.state === 'complete') {
          // Final catch-up for any segments that landed in the same tick
          await fetchNewSegments(jobId);
          finishJob('complete');
          if (j.archive_filename) {
            await loadArchive(j.archive_filename);
          }
          setStatus('Transcription complete.');
          if (view === 'archive') fetchArchives();
        } else if (j.state === 'failed') {
          finishJob('failed');
          setJobError(j);
          setStatus(`Failed: ${j.error_code || 'UNKNOWN'}`);
        } else if (j.state === 'cancelled') {
          finishJob('cancelled');
          setJob(null);
          setJobError(null);
          setTranscription([]);
          segmentOffsetRef.current = 0;
          setStatus('Ready');
        }
      } catch (e) {
        if (e.response && e.response.status === 404) {
          finishJob('lost');
          setStatus('Job not found. The server may have restarted.');
        }
      }
    }, 2000);
  };

  // Reattach to an in-flight job on page load / refresh
  useEffect(() => {
    if (!username) return;
    const saved = localStorage.getItem('scribe_active_job');
    if (!saved) return;
    (async () => {
      try {
        const res = await axios.get(`/api/jobs/${saved}`);
        const j = res.data;
        if (['complete', 'failed', 'cancelled'].includes(j.state)) {
          localStorage.removeItem('scribe_active_job');
          if (j.state === 'complete' && j.archive_filename) {
            setJob(j);
            await loadArchive(j.archive_filename);
            setStatus('Resumed: transcription already complete.');
          } else if (j.state === 'failed') {
            setJobError(j);
            setStatus(`Previous job failed: ${j.error_code || 'UNKNOWN'}`);
          } else {
            setStatus('Previous job was cancelled.');
          }
          return;
        }
        // Still running — reattach
        currentJobIdRef.current = saved;
        segmentOffsetRef.current = 0;
        setTranscription([]);
        setJob(j);
        setIsLoading(true);
        setStatus('Reconnected to running job.');
        pollJob(saved);
      } catch (e) {
        localStorage.removeItem('scribe_active_job');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Stop polling on unmount
  useEffect(() => () => stopPolling(), []);

  const handleTranscribe = async () => {
    if (uploadMode === 'file' && !selectedFile) {
      setStatus('Please select an audio/video file first.');
      return;
    }
    if (uploadMode === 'youtube' && !youtubeUrl) {
      setStatus('Please enter a valid YouTube URL.');
      return;
    }

    // Validate / confirm notification email if checkbox is on
    let emailToSend = null;
    if (notifyEmail) {
      const entered = (emailInput || '').trim();
      if (!entered) {
        setStatus('Please enter an email for notification.');
        return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(entered)) {
        setStatus('That email does not look valid.');
        return;
      }
      if (savedEmail && entered !== savedEmail) {
        const ok = window.confirm(
          `This department currently notifies: ${savedEmail}\n\nReplace it with ${entered}?`
        );
        if (!ok) return;
      }
      emailToSend = entered;
    }

    setIsLoading(true);
    setJobError(null);
    setJob(null);
    setStatus('Uploading…');
    setTranscription([]);
    segmentOffsetRef.current = 0;
    setUploadProgress(uploadMode === 'file' ? { loaded: 0, total: selectedFile.size, pct: 0 } : null);

    const formData = new FormData();
    formData.append('model_size', modelSize);
    formData.append('meeting_date', meetingDate);
    if (emailToSend) formData.append('notify_email', emailToSend);
    if (uploadMode === 'file') {
      formData.append('file', selectedFile);
    } else {
      formData.append('youtube_url', youtubeUrl);
    }

    try {
      const response = await axios.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: (e) => {
          if (uploadMode !== 'file') return;
          const total = e.total || selectedFile.size || 0;
          const pct = total ? Math.round((e.loaded / total) * 100) : 0;
          setUploadProgress({ loaded: e.loaded, total, pct });
          if (pct < 100) {
            setStatus(`Uploading ${pct}%…`);
          } else {
            setStatus('Upload complete. Starting job…');
          }
        },
      });
      setUploadProgress(null);
      const jobId = response.data.job_id;
      currentJobIdRef.current = jobId;
      localStorage.setItem('scribe_active_job', jobId);
      if (emailToSend) setSavedEmail(emailToSend);
      setStatus('Job started. Waiting for first status…');
      pollJob(jobId);
    } catch (error) {
      console.error('Error:', error);
      setIsLoading(false);
      setUploadProgress(null);
      const detail = error.response && error.response.data && error.response.data.detail;
      setStatus(detail ? `Error: ${detail}` : 'Error starting transcription.');
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
                <div className="d-grid gap-2 mb-4">
                    {availableUsers.length > 0 ? (
                        availableUsers.map(u => (
                            <div key={u} className="d-flex align-items-center">
                                <button className="btn btn-outline-primary btn-lg fw-bold flex-grow-1 text-start" onClick={() => performLogin(u)}>
                                    👤 {u}
                                </button>
                                <button className="btn btn-outline-danger ms-2" title="Delete Department" onClick={() => deleteDepartment(u)}>
                                    🗑️
                                </button>
                            </div>
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
        <span 
            className="navbar-brand mb-0 h1 d-flex align-items-center" 
            onClick={() => setView('transcribe')}
            style={{ cursor: 'pointer' }}
            title="Return to New Transcription"
        >
          <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>🏛️</span>
          County Scribe
          <span className="badge bg-light text-primary ms-2" style={{fontSize: '0.65rem', verticalAlign: 'middle'}}>v2.0</span>
          <span className="text-white-50 fs-6 ms-2">| Official Meeting Transcription</span>
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
            <button className="btn btn-sm btn-outline-light me-2" title="Settings" onClick={() => setShowSettingsModal(true)}>
                ⚙️
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

            <div className="mb-3">
                <div className="form-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="notifyEmail"
                        checked={notifyEmail}
                        onChange={(e) => setNotifyEmail(e.target.checked)}
                        disabled={isLoading}
                    />
                    <label className="form-check-label small fw-bold text-muted" htmlFor="notifyEmail">
                        📧 Email me when finished
                    </label>
                </div>
                {notifyEmail && (
                    <div className="mt-2">
                        <input
                            type="email"
                            className="form-control form-control-sm"
                            placeholder="name@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            disabled={isLoading}
                        />
                        {savedEmail && emailInput === savedEmail && (
                            <div className="form-text small text-success">✓ Using saved address for this department.</div>
                        )}
                        {savedEmail && emailInput && emailInput !== savedEmail && (
                            <div className="form-text small text-warning">
                                ⚠ Different from saved ({savedEmail}). You'll be asked to confirm.
                            </div>
                        )}
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
            </div>

            {uploadProgress && (
                <div className="alert alert-primary small">
                    <div className="d-flex justify-content-between align-items-baseline mb-1">
                        <span className="fw-bold">Uploading</span>
                        <span>{uploadProgress.pct}%</span>
                    </div>
                    <div className="progress mb-1" style={{height: '8px'}}>
                        <div className="progress-bar bg-primary progress-bar-striped progress-bar-animated"
                             style={{width: `${uploadProgress.pct}%`}} />
                    </div>
                    <div className="text-muted" style={{fontSize: '0.7rem'}}>
                        {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
                    </div>
                </div>
            )}

            <JobStatusPanel
              status={status}
              job={job}
              jobError={jobError}
              showErrorDetail={showErrorDetail}
              setShowErrorDetail={setShowErrorDetail}
            />
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
                                                <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => renameArchive(file.filename)} title="Rename">✏️ Rename</button>
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

      {showSettingsModal && (
        <SettingsModal onClose={() => setShowSettingsModal(false)} />
      )}

      {showHelpModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content shadow-lg border-0">
                    <div className="modal-header bg-primary text-white">
                        <h5 className="modal-title">🏛️ County Scribe: Complete User Guide</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={() => setShowHelpModal(false)}></button>
                    </div>
                    <div className="modal-body p-4" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <div className="alert alert-info py-2 small mb-3">
                            <strong>✨ What's new in v2.0:</strong> Live progress bar with real percentages and ETA, live partial transcript as it's generated, up to 2 meetings can process at the same time (3rd is queued), jobs survive browser refresh, optional email notification when finished, rename/search archives, and a new ⚙️ Settings panel for mail server setup.
                        </div>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Step 1: Setting up the Meeting</h6>
                            <ul className="small text-muted">
                                <li><strong>📅 Meeting Date:</strong> First, pick the actual date the meeting happened using the date picker in the sidebar. This ensures your archives are sorted correctly.</li>
                                <li><strong>📂 Source Material:</strong> You can either upload a file (drag &amp; drop) OR switch the tab to paste a <strong>YouTube Link</strong> if the meeting was streamed.</li>
                                <li><strong>📧 Email me when finished</strong> (optional): check the box and enter your email. The address is saved for your department; next time it will be pre-filled and you'll be asked to confirm before any change.</li>
                            </ul>
                        </section>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Step 2: Start Transcription</h6>
                            <p className="small text-muted">Click <strong>Start Transcription</strong>. A typical 90-minute meeting takes about 10-15 minutes to process. You'll see:</p>
                            <ul className="small text-muted">
                                <li>An <strong>upload progress bar</strong> while the file is being sent.</li>
                                <li>A <strong>live status panel</strong> with phase (downloading / preparing / transcribing / saving), real percentage, elapsed time, and ETA.</li>
                                <li>The <strong>transcript fills in live</strong> on the right as each segment is recognized.</li>
                                <li>If no activity is seen for 60 seconds, the panel warns that the job may be stuck so you can Stop and retry.</li>
                            </ul>
                            <p className="small text-muted mb-0"><i>You can close the browser or refresh — when you come back, the job reattaches automatically. If you opted in for email, you'll also get a message when it's done (or if it fails).</i></p>
                        </section>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Two meetings at once</h6>
                            <p className="small text-muted mb-0">Up to <strong>2 meetings can process at the same time</strong>. If both slots are busy, your job is queued and the status panel shows how many are ahead of you — no more "System Busy" errors.</p>
                        </section>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Step 3: Proofreading</h6>
                            <p className="small text-muted">Use the <strong>"Show Details (Timestamps)"</strong> toggle at the top if you need to see exactly when someone spoke. By default, it shows a clean, readable draft.</p>
                        </section>
                        <section className="mb-4">
                            <h6 className="fw-bold text-primary">Managing Archives</h6>
                            <ul className="small text-muted mb-0">
                                <li><strong>Open</strong> any past transcription from the 🗄️ Archives tab.</li>
                                <li><strong>✏️ Rename</strong> an archive to give it a friendlier name (the date prefix is preserved for sorting).</li>
                                <li><strong>Delete</strong> removes it permanently. Archives older than 180 days are auto-pruned.</li>
                            </ul>
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
                        <section className="mb-3">
                            <h6 className="fw-bold text-primary">Admin: Mail Server &amp; App URL</h6>
                            <p className="small text-muted mb-0">Click the <strong>⚙️ gear icon</strong> in the top-right to configure the SMTP server used for email notifications and the App Base URL that appears in those emails. A <strong>Send Test</strong> button lets you verify delivery without running a full transcription.</p>
                        </section>
                        <div className="alert alert-success py-2 small mb-0"><strong>✅ Concurrency:</strong> Up to 2 meetings process in parallel on this server. A 3rd request is queued automatically — your status panel will show your queue position.</div>
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