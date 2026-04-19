// utils/api.js — Centralized API client for all backend calls

import axios from 'axios';
import { getAuthToken } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global error handling
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

// ── FILES ──────────────────────────────────

/**
 * Get presigned S3 upload URL + create metadata record
 */
export async function getUploadUrl(fileName, fileSize, mimeType, parentFolder = 'root') {
  return api.post('/files/upload-url', { fileName, fileSize, mimeType, parentFolder });
}

/**
 * Upload file DIRECTLY to S3 using presigned URL
 * This bypasses the API and Lambda entirely — unlimited file size
 */
export async function uploadFileToS3(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed: ${xhr.status}`));
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

/**
 * Full upload flow: get URL → upload to S3 → return fileId
 */
export async function uploadFile(file, parentFolder = 'root', onProgress) {
  // Step 1: Get presigned URL + create metadata
  const { uploadUrl, fileId } = await getUploadUrl(
    file.name, file.size, file.type, parentFolder
  );

  // Step 2: Upload directly to S3 (no Lambda size limit!)
  await uploadFileToS3(uploadUrl, file, onProgress);

  return fileId;
}

export async function listFiles(folder = 'root', options = {}) {
  const params = new URLSearchParams({ folder, ...options });
  return api.get(`/files?${params}`);
}

export async function getFile(fileId) {
  return api.get(`/files/${fileId}`);
}

export async function deleteFile(fileId, permanent = false) {
  return api.delete(`/files/${fileId}?permanent=${permanent}`);
}

export async function updateFile(fileId, updates) {
  return api.put(`/files/${fileId}`, updates);
}

export async function shareFile(fileId, expiresInHours = 24) {
  return api.post(`/files/${fileId}/share`, { expiresInHours });
}

// ── FOLDERS ────────────────────────────────

export async function createFolder(folderName, parentFolder = 'root') {
  return api.post('/folders', { folderName, parentFolder });
}

export async function listFolders() {
  return api.get('/folders');
}
