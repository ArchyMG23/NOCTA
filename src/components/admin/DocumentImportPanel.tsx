import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  FolderOpen,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  cancelImportJob,
  commitImportItemsToCatalog,
  createImportJobWithItems,
  fetchDocumentImportsHistory,
  fetchFormats,
  fetchImportItems,
  fetchUniverses,
  updateImportItemReview,
} from '../../services/noctaService';
import type {
  ActivityFormat,
  DocumentImport,
  ImportExtractedItem,
  Universe,
} from '../../types/nocta';

interface DocumentImportPanelProps {
  actorRole: string;
}

export function DocumentImportPanel({ actorRole }: DocumentImportPanelProps) {
  const { firebaseUser } = useAuth();
  const { lang, t } = useI18n();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [universes, setUniverses] = useState<Universe[]>([]);
  const [formats, setFormats] = useState<ActivityFormat[]>([]);
  const [importsHistory, setImportsHistory] = useState<DocumentImport[]>([]);
  const [activeImport, setActiveImport] = useState<DocumentImport | null>(null);
  const [items, setItems] = useState<ImportExtractedItem[]>([]);

  const loadCatalogAndHistory = async () => {
    const [uList, fList, hList] = await Promise.all([
      fetchUniverses(),
      fetchFormats(),
      fetchDocumentImportsHistory(),
    ]);
    setUniverses(uList);
    setFormats(fList);
    setImportsHistory(hList);
  };

  useEffect(() => {
    void loadCatalogAndHistory();
  }, []);

  const handleExtractUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !selectedFile) return;

    setErrorMsg(null);
    setStatusMsg(null);

    const lower = selectedFile.name.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx')) {
      setErrorMsg(
        lang === 'fr'
          ? 'Format refusé. Seuls les fichiers .pdf et .docx sont autorisés.'
          : 'Invalid format. Only .pdf and .docx files are accepted.'
      );
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMsg(
        lang === 'fr'
          ? 'Fichier trop volumineux (limite serveur : 15 Mo).'
          : 'File exceeds the 15 MB limit.'
      );
      return;
    }

    setUploading(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const formData = new FormData();
      formData.append('document', selectedFile);

      const resp = await fetch('/api/import/extract', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
        body: formData,
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.message || data.error || 'Extraction failed');
      }

      const created = await createImportJobWithItems({
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        serverFileId: data.serverFileId,
        requiresOcr: Boolean(data.requiresOcr),
        warnings: Array.isArray(data.warnings) ? data.warnings : [],
        blocks: Array.isArray(data.blocks) ? data.blocks : [],
        actorUid: firebaseUser.uid,
        actorRole,
      });

      setActiveImport(created.importDoc);
      setItems(created.items);
      setSelectedFile(null);
      await loadCatalogAndHistory();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setUploading(false);
    }
  };

  const handleResumeImport = async (imp: DocumentImport) => {
    setErrorMsg(null);
    setStatusMsg(null);
    const loadedItems = await fetchImportItems(imp.id);
    setActiveImport(imp);
    setItems(loadedItems);
  };

  const handleUpdateItem = async (updated: ImportExtractedItem) => {
    if (!activeImport) return;
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    await updateImportItemReview(activeImport.id, updated);
  };

  const handleCommit = async (targetStatus: 'draft' | 'published') => {
    if (!firebaseUser || !activeImport) return;
    setCommitting(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const count = await commitImportItemsToCatalog({
        importDoc: activeImport,
        items,
        targetStatus,
        actorUid: firebaseUser.uid,
        actorRole,
      });
      setStatusMsg(
        lang === 'fr'
          ? `${count} élément(s) enregistré(s) en tant que ${targetStatus === 'published' ? 'publié' : 'brouillon'}.`
          : `${count} item(s) saved as ${targetStatus}.`
      );
      await handleResumeImport({ ...activeImport, status: targetStatus === 'published' ? 'published' : 'partially_published' });
      await loadCatalogAndHistory();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t.states.errorTitle);
    } finally {
      setCommitting(false);
    }
  };

  const handleCancelImport = async () => {
    if (!firebaseUser || !activeImport) return;
    if (!window.confirm(t.admin.confirmDeleteBody)) return;
    await cancelImportJob(activeImport.id, firebaseUser.uid, actorRole);
    setActiveImport(null);
    setItems([]);
    await loadCatalogAndHistory();
  };

  const handleDownloadOriginal = async (serverFileId: string, fileName: string) => {
    if (!firebaseUser) return;
    const idToken = await firebaseUser.getIdToken();
    const resp = await fetch(`/api/import/original/${serverFileId}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) {
      setErrorMsg(lang === 'fr' ? 'Fichier privé introuvable.' : 'Private file not found.');
      return;
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F4EEF0]">
          {t.admin.importModule.title}
        </h2>
        <p className="text-sm text-[#B8AAB0] max-w-3xl">{t.admin.importModule.subtitle}</p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-[#32101D] border border-[#781D35] text-xs text-[#F4EEF0]">
          {errorMsg}
        </div>
      )}

      {statusMsg && (
        <div className="p-4 rounded-lg bg-[#191217] border border-[#C5A276]/60 text-xs text-[#C5A276]">
          {statusMsg}
        </div>
      )}

      {/* Upload Form */}
      <form
        onSubmit={(e) => void handleExtractUpload(e)}
        className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4"
      >
        <label className="block text-xs font-medium text-[#B8AAB0]">
          {t.admin.importModule.selectFileLabel}
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="flex-1 text-xs text-[#B8AAB0] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-[#32101D] file:text-xs file:font-medium file:bg-[#100D10] file:text-[#F4EEF0] hover:file:border-[#C5A276]"
          />
          <button
            type="submit"
            disabled={!selectedFile || uploading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#781D35] hover:bg-[#4B1028] disabled:opacity-45 text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? t.states.loading : t.admin.importModule.extractBtn}</span>
          </button>
        </div>
      </form>

      {/* Active Import Preview & Manual Classification */}
      {activeImport && (
        <section className="bg-[#191217] border border-[#4B1028] rounded-xl p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#32101D] pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-[#C5A276]">
                <FileText className="w-4 h-4" />
                <span>{activeImport.fileName}</span>
                <span>·</span>
                <span className="font-mono-tabular">
                  {activeImport.totalExtracted} {lang === 'fr' ? 'blocs' : 'blocks'}
                </span>
                <span>·</span>
                <span>
                  {activeImport.duplicateCount} {lang === 'fr' ? 'doublons' : 'duplicates'}
                </span>
              </div>
              <h3 className="font-display text-2xl font-semibold text-[#F4EEF0]">
                {t.admin.importModule.previewTitle}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void handleDownloadOriginal(activeImport.serverFileId, activeImport.fileName)
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#32101D] hover:border-[#C5A276] text-xs text-[#B8AAB0] hover:text-[#F4EEF0] rounded-lg cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.admin.importModule.downloadOriginalBtn}</span>
              </button>
              <button
                type="button"
                disabled={committing}
                onClick={() => void handleCommit('draft')}
                className="px-4 py-2 bg-[#32101D] hover:bg-[#4B1028] text-xs text-[#F4EEF0] rounded-lg cursor-pointer"
              >
                {t.admin.importModule.saveDraftsBtn}
              </button>
              <button
                type="button"
                disabled={committing}
                onClick={() => void handleCommit('published')}
                className="px-4 py-2 bg-[#781D35] hover:bg-[#4B1028] text-xs font-medium text-[#F4EEF0] rounded-lg cursor-pointer"
              >
                {t.admin.importModule.publishSelectedBtn}
              </button>
              {activeImport.status !== 'published' && (
                <button
                  type="button"
                  onClick={() => void handleCancelImport()}
                  className="inline-flex items-center gap-1 px-3 py-2 border border-[#781D35] text-xs text-[#B8AAB0] hover:text-[#F4EEF0] rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.admin.importModule.cancelImportBtn}</span>
                </button>
              )}
            </div>
          </div>

          {activeImport.requiresOcr && (
            <div className="p-4 rounded-lg bg-[#32101D] border border-[#C5A276] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C5A276]">
                <AlertTriangle className="w-4 h-4" />
                <span>{t.admin.importModule.ocrWarningTitle}</span>
              </div>
              <p className="text-xs text-[#F4EEF0]/90">{t.admin.importModule.ocrWarningBody}</p>
            </div>
          )}

          <div className="space-y-4">
            {items.map((item) => {
              const itemFormats = formats.filter(
                (f) => f.universeId === (item.universeId || 'decouverte')
              );
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border space-y-3 ${
                    item.reviewState === 'accepted'
                      ? 'bg-[#100D10] border-[#C5A276]/60'
                      : item.reviewState === 'published'
                        ? 'bg-[#100D10] border-[#4B1028]'
                        : 'bg-[#100D10]/70 border-[#32101D]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 text-[#B8AAB0]">
                      <span className="font-mono-tabular text-[#C5A276]">
                        #{item.order + 1}
                      </span>
                      <span>·</span>
                      <span>{item.detectedKind}</span>
                      <span>·</span>
                      <span>{item.reviewState}</span>
                      {item.isDuplicate && (
                        <>
                          <span>·</span>
                          <span className="text-[#C5A276] font-medium">
                            {t.admin.importModule.duplicateBadge} ({item.duplicateActivityId})
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={item.reviewState === 'published'}
                        onClick={() =>
                          void handleUpdateItem({ ...item, reviewState: 'accepted' })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer ${
                          item.reviewState === 'accepted'
                            ? 'bg-[#781D35] text-[#F4EEF0]'
                            : 'border border-[#32101D] text-[#B8AAB0] hover:text-[#F4EEF0]'
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>{t.admin.importModule.acceptBtn}</span>
                      </button>
                      <button
                        type="button"
                        disabled={item.reviewState === 'published'}
                        onClick={() =>
                          void handleUpdateItem({ ...item, reviewState: 'rejected' })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer ${
                          item.reviewState === 'rejected'
                            ? 'bg-[#32101D] text-[#F4EEF0]'
                            : 'border border-[#32101D] text-[#B8AAB0] hover:text-[#F4EEF0]'
                        }`}
                      >
                        <X className="w-3 h-3" />
                        <span>{t.admin.importModule.rejectBtn}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={item.assignedType}
                      disabled={item.reviewState === 'published'}
                      onChange={(e) =>
                        void handleUpdateItem({
                          ...item,
                          assignedType: e.target.value as ImportExtractedItem['assignedType'],
                        })
                      }
                      className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                    >
                      <option value="question">Question</option>
                      <option value="challenge">Défi / Challenge</option>
                      <option value="scenario">Scénario / Scenario</option>
                      <option value="educational">Fiche éducative / Educational</option>
                      <option value="instruction">Consigne / Instruction</option>
                      <option value="ignore">Ignorer / Ignore</option>
                    </select>

                    <select
                      value={item.universeId || 'decouverte'}
                      disabled={item.reviewState === 'published'}
                      onChange={(e) => {
                        const uId = e.target.value;
                        const firstFmt = formats.find((f) => f.universeId === uId)?.id || null;
                        void handleUpdateItem({
                          ...item,
                          universeId: uId,
                          formatId: firstFmt,
                        });
                      }}
                      className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                    >
                      {universes.map((u) => (
                        <option key={u.id} value={u.id}>
                          {lang === 'fr' ? u.titleFr : u.titleEn}
                        </option>
                      ))}
                    </select>

                    <select
                      value={item.formatId || ''}
                      disabled={item.reviewState === 'published'}
                      onChange={(e) =>
                        void handleUpdateItem({ ...item, formatId: e.target.value })
                      }
                      className="px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#F4EEF0]"
                    >
                      {itemFormats.map((f) => (
                        <option key={f.id} value={f.id}>
                          {lang === 'fr' ? f.titleFr : f.titleEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={item.title}
                    disabled={item.reviewState === 'published'}
                    onChange={(e) => setItems((p) => p.map((x) => (x.id === item.id ? { ...x, title: e.target.value } : x)))}
                    onBlur={() => void handleUpdateItem(item)}
                    className="w-full px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs font-medium text-[#F4EEF0]"
                  />

                  <textarea
                    rows={2}
                    value={item.body}
                    disabled={item.reviewState === 'published'}
                    onChange={(e) => setItems((p) => p.map((x) => (x.id === item.id ? { ...x, body: e.target.value } : x)))}
                    onBlur={() => void handleUpdateItem(item)}
                    className="w-full px-3 py-2 bg-[#191217] border border-[#32101D] rounded-lg text-xs text-[#B8AAB0]"
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Import History */}
      <section className="bg-[#191217] border border-[#32101D] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl font-semibold text-[#F4EEF0]">
            {t.admin.importModule.historyTitle}
          </h3>
          <FolderOpen className="w-4 h-4 text-[#C5A276]" />
        </div>

        {importsHistory.length === 0 ? (
          <p className="text-xs text-[#B8AAB0]">{t.states.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#32101D] text-[#B8AAB0]">
                  <th className="py-2.5 pr-4">Document</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 pr-4 text-right">Extracted</th>
                  <th className="py-2.5 pr-4 text-right">Accepted</th>
                  <th className="py-2.5 pr-4 text-right">Duplicates</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#32101D]">
                {importsHistory.map((imp) => (
                  <tr key={imp.id} className="hover:bg-[#100D10]/50">
                    <td className="py-3 pr-4 font-medium text-[#F4EEF0]">{imp.fileName}</td>
                    <td className="py-3 pr-4 text-[#C5A276]">{imp.status}</td>
                    <td className="py-3 pr-4 text-right font-mono-tabular">
                      {imp.totalExtracted}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular">
                      {imp.acceptedCount}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono-tabular">
                      {imp.duplicateCount}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleResumeImport(imp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-[#32101D] hover:border-[#C5A276] rounded text-[#F4EEF0] cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>{t.admin.importModule.resumeBtn}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
