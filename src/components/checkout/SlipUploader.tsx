'use client'

import React, { useRef, useState } from 'react'
import { Upload, X, FileImage, Image as ImageIcon, CheckCircle2 } from 'lucide-react'

interface SlipUploaderProps {
  onFileSelect: (file: File | null) => void
  selectedFile: File | null
  isLoading?: boolean
}

export default function SlipUploader({ onFileSelect, selectedFile, isLoading = false }: SlipUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true)
    } else if (e.type === 'dragleave') {
      setIsDragActive(false)
    }
  }

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น (.png, .jpg, .jpeg)')
      return
    }
    // Limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดไฟล์ต้องไม่เกิน 5MB')
      return
    }

    onFileSelect(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }

  const removeFile = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onFileSelect(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold uppercase tracking-wider text-textSecondary mb-1">
        แนบสลิปการโอนเงิน <span className="text-red-500">*</span>
      </label>

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center transition-all duration-300 ${
          isLoading ? 'pointer-events-none opacity-60' : 'cursor-pointer'
        } ${
          selectedFile
            ? 'border-emerald-500/50 bg-emerald-500/5'
            : isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-surfaceLight/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isLoading}
        />

        {previewUrl ? (
          <div className="w-full flex flex-col items-center space-y-4">
            {/* Image Preview Container */}
            <div className="relative group w-40 h-40 sm:w-48 sm:h-48 rounded-xl overflow-hidden border border-border shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Receipt slip preview"
                className="w-full h-full object-cover"
              />
              {!isLoading && (
                <button
                  type="button"
                  onClick={removeFile}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-md transition-colors hover:scale-105"
                  title="ลบรูปภาพ"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* File Info */}
            <div className="flex items-center gap-2.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl max-w-xs sm:max-w-md">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="text-left min-w-0">
                <p className="text-xs font-semibold text-emerald-300 truncate">
                  {selectedFile?.name}
                </p>
                <p className="text-[10px] text-emerald-400/80 mt-0.5">
                  {selectedFile ? formatFileSize(selectedFile.size) : ''}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-surfaceLight flex items-center justify-center text-textSecondary border border-border group-hover:text-primary transition-colors">
              <Upload className="w-6 h-6 text-textMuted group-hover:text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-textPrimary">
                ลากรูปภาพมาวางที่นี่ หรือ <span className="text-primary hover:underline">คลิกเพื่ออัปโหลด</span>
              </p>
              <p className="text-xs text-textMuted mt-1">
                รองรับไฟล์ PNG, JPG, JPEG ขนาดไม่เกิน 5MB
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
