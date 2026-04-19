// pages/dashboard.js — Main file manager interface

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast, { Toaster } from 'react-hot-toast';
import {
  Upload, FolderPlus, Download, Trash2, Share2,
  Search, Grid, List, File, Folder, Image,
  FileText, Film, Music, Archive, X, ChevronRight,
  LogOut, Cloud, RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  listFiles, listFolders, uploadFile, deleteFile,
  createFolder, shareFile, getFile,
} from '../utils/api';
import { signOut, getCurrentUser } from '../utils/auth';
import { useRouter } from 'next/router';

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (file) => {
  if (file.type === 'folder') return <Folder className="w-5 h-5 text-yellow-500" />;
  const ct = file.contentType || '';
  if (ct.startsWith('image/')) return <Image className="w-5 h-5 text-blue-400" />;
  if (ct.startsWith('video/')) return <Film className="w-5 h-5 text-purple-400" />;
  if (ct.startsWith('audio/')) return <Music className="w-5 h-5 text-green-400" />;
  if (ct.includes('pdf') || ct.includes('text')) return <FileText className="w-5 h-5 text-red-400" />;
  if (ct.includes('zip') || ct.includes('tar')) return <Archive className="w-5 h-5 text-orange-400" />;
  return <File className="w-5 h-5 text-gray-400" />;
};

export default function Dashboard() {
  const router = useRouter();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('root');
  const [breadcrumb, setBreadcrumb] = useState([{ id: 'root', name: 'My Drive' }]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState({}); // { fileId: { name, progress, status } }
  const [selected, setSelected] = useState(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) { router.push('/login'); return; }
    user.getSession((err, session) => {
      if (err || !session?.isValid()) { router.push('/login'); return; }
      const payload = session.getIdToken().payload;
      setUserEmail(payload.email);
    });
    loadFiles();
  }, [currentFolder]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const [filesRes, foldersRes] = await Promise.all([
        listFiles(currentFolder, search ? { search } : {}),
        listFolders(),
      ]);
      setFiles(filesRes.files || []);
      setFolders(foldersRes.folders?.filter(f => f.parentFolder === currentFolder) || []);
    } catch (err) {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    for (const file of acceptedFiles) {
      const tempId = `upload_${Date.now()}_${Math.random()}`;
      setUploads(prev => ({
        ...prev,
        [tempId]: { name: file.name, progress: 0, status: 'uploading' }
      }));

      try {
        await uploadFile(file, currentFolder, (progress) => {
          setUploads(prev => ({
            ...prev,
            [tempId]: { ...prev[tempId], progress }
          }));
        });

        setUploads(prev => ({
          ...prev,
          [tempId]: { ...prev[tempId], progress: 100, status: 'done' }
        }));
        toast.success(`"${file.name}" uploaded`);
        setTimeout(() => setUploads(prev => {
          const n = { ...prev }; delete n[tempId]; return n;
        }), 3000);
        loadFiles();
      } catch (err) {
        setUploads(prev => ({
          ...prev,
          [tempId]: { ...prev[tempId], status: 'error' }
        }));
        toast.error(`Failed to upload "${file.name}"`);
      }
    }
  }, [currentFolder]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim(), currentFolder);
      toast.success('Folder created');
      setNewFolderName('');
      setShowNewFolder(false);
      loadFiles();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (fileId, fileName) => {
    if (!confirm(`Move "${fileName}" to trash?`)) return;
    try {
      await deleteFile(fileId);
      toast.success('Moved to trash');
      loadFiles();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const handleShare = async (fileId, fileName) => {
    try {
      const { shareUrl } = await shareFile(fileId, 24);
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied! (expires in 24h)');
    } catch (err) {
      toast.error('Share failed');
    }
  };

  const handleDownload = async (fileId, fileName) => {
    try {
      const { downloadUrl } = await getFile(fileId);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      a.click();
    } catch (err) {
      toast.error('Download failed');
    }
  };

  const navigateToFolder = (folderId, folderName) => {
    setCurrentFolder(folderId);
    setBreadcrumb(prev => [...prev, { id: folderId, name: folderName }]);
  };

  const navigateBreadcrumb = (index) => {
    const crumb = breadcrumb[index];
    setCurrentFolder(crumb.id);
    setBreadcrumb(prev => prev.slice(0, index + 1));
  };

  const allItems = [
    ...folders.map(f => ({ ...f, type: 'folder' })),
    ...files.filter(f => f.type !== 'folder'),
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white" {...getRootProps()}>
      <input {...getInputProps()} />
      <Toaster position="top-right" toastOptions={{ style: { background: '#1f2937', color: '#fff' } }} />

      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 bg-blue-600/20 border-4 border-blue-500 border-dashed z-50 flex items-center justify-center">
          <div className="text-2xl font-semibold text-blue-300">Drop files to upload</div>
        </div>
      )}

      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cloud className="w-7 h-7 text-blue-400" />
          <span className="text-lg font-semibold">CloudDrive</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              className="bg-gray-800 pl-9 pr-4 py-2 rounded-lg text-sm border border-gray-700 focus:outline-none focus:border-blue-500 w-64"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadFiles()}
            />
          </div>
          <span className="text-gray-400 text-sm">{userEmail}</span>
          <button onClick={() => { signOut(); router.push('/login'); }}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Sidebar */}
        <aside className="w-56 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-2">
          <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            <span className="text-sm font-medium">Upload Files</span>
            <input type="file" multiple className="hidden" onChange={(e) => onDrop(Array.from(e.target.files))} />
          </label>

          <button
            onClick={() => setShowNewFolder(true)}
            className="flex items-center gap-2 text-gray-400 hover:text-white hover:bg-gray-800 px-4 py-2.5 rounded-lg text-sm transition-colors">
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>

          <hr className="border-gray-700 my-2" />

          <button
            onClick={() => { setCurrentFolder('root'); setBreadcrumb([{ id: 'root', name: 'My Drive' }]); }}
            className="flex items-center gap-2 text-gray-300 hover:text-white hover:bg-gray-800 px-4 py-2.5 rounded-lg text-sm transition-colors">
            <Folder className="w-4 h-4 text-blue-400" />
            My Drive
          </button>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 mb-4 text-sm text-gray-400">
            {breadcrumb.map((crumb, i) => (
              <div key={crumb.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="w-3 h-3" />}
                <button
                  onClick={() => navigateBreadcrumb(i)}
                  className={`hover:text-white transition-colors ${i === breadcrumb.length - 1 ? 'text-white font-medium' : ''}`}>
                  {crumb.name}
                </button>
              </div>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <button onClick={loadFiles} className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New folder modal */}
          {showNewFolder && (
            <div className="mb-4 flex items-center gap-2 bg-gray-800 rounded-lg p-3">
              <Folder className="w-4 h-4 text-yellow-500" />
              <input
                autoFocus
                className="bg-transparent flex-1 text-sm outline-none"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setShowNewFolder(false);
                }}
              />
              <button onClick={handleCreateFolder} className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded">Create</button>
              <button onClick={() => setShowNewFolder(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Active uploads */}
          {Object.entries(uploads).length > 0 && (
            <div className="mb-4 space-y-2">
              {Object.entries(uploads).map(([id, upload]) => (
                <div key={id} className="bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                  <Upload className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{upload.name}</div>
                    {upload.status === 'uploading' && (
                      <div className="mt-1 bg-gray-700 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${upload.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {upload.status === 'done' ? '✅' : upload.status === 'error' ? '❌' : `${upload.progress}%`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* File grid / list */}
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-500">Loading...</div>
          ) : allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-3">
              <Cloud className="w-12 h-12" />
              <p className="text-sm">Drop files here or click Upload</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {allItems.map((item) => (
                <FileCard
                  key={item.fileId}
                  file={item}
                  onOpen={() => item.type === 'folder'
                    ? navigateToFolder(item.fileId, item.fileName)
                    : handleDownload(item.fileId, item.fileName)}
                  onDelete={() => handleDelete(item.fileId, item.fileName)}
                  onShare={() => handleShare(item.fileId, item.fileName)}
                  onDownload={() => handleDownload(item.fileId, item.fileName)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-12 text-xs text-gray-500 px-3 py-2 border-b border-gray-800">
                <span className="col-span-6">Name</span>
                <span className="col-span-2">Size</span>
                <span className="col-span-3">Modified</span>
                <span className="col-span-1" />
              </div>
              {allItems.map((item) => (
                <FileRow
                  key={item.fileId}
                  file={item}
                  onOpen={() => item.type === 'folder'
                    ? navigateToFolder(item.fileId, item.fileName)
                    : handleDownload(item.fileId, item.fileName)}
                  onDelete={() => handleDelete(item.fileId, item.fileName)}
                  onShare={() => handleShare(item.fileId, item.fileName)}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────

function FileCard({ file, onOpen, onDelete, onShare, onDownload }) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="bg-gray-800 rounded-xl p-3 cursor-pointer hover:bg-gray-700 transition-colors relative group"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={onOpen}
    >
      <div className="flex justify-center mb-2 h-10 items-center">
        {getFileIcon(file)}
      </div>
      <div className="text-xs text-center truncate text-gray-200" title={file.fileName}>
        {file.fileName}
      </div>
      {file.type !== 'folder' && (
        <div className="text-xs text-center text-gray-500 mt-0.5">{formatBytes(file.fileSize)}</div>
      )}

      {/* Hover actions */}
      {hover && (
        <div className="absolute top-1.5 right-1.5 flex gap-1 bg-gray-900/90 rounded-lg p-1">
          {file.type !== 'folder' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onDownload(); }}
                className="p-1 hover:text-blue-400 text-gray-400">
                <Download className="w-3 h-3" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onShare(); }}
                className="p-1 hover:text-green-400 text-gray-400">
                <Share2 className="w-3 h-3" />
              </button>
            </>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 hover:text-red-400 text-gray-400">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function FileRow({ file, onOpen, onDelete, onShare }) {
  return (
    <div className="grid grid-cols-12 items-center px-3 py-2 hover:bg-gray-800 rounded-lg cursor-pointer group"
      onDoubleClick={onOpen}>
      <div className="col-span-6 flex items-center gap-2">
        {getFileIcon(file)}
        <span className="text-sm truncate">{file.fileName}</span>
      </div>
      <span className="col-span-2 text-xs text-gray-500">
        {file.type === 'folder' ? '—' : formatBytes(file.fileSize)}
      </span>
      <span className="col-span-3 text-xs text-gray-500">
        {file.updatedAt ? formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true }) : '—'}
      </span>
      <div className="col-span-1 flex gap-1 opacity-0 group-hover:opacity-100 justify-end">
        {file.type !== 'folder' && (
          <button onClick={(e) => { e.stopPropagation(); onShare(); }}
            className="p-1 hover:text-green-400 text-gray-400">
            <Share2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 hover:text-red-400 text-gray-400">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
