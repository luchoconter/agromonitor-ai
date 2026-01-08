import React, { useState, useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useMediaRecorder } from '../hooks/useMediaRecorder';
import { useOfflinePrescriptions } from '../hooks/useOfflineMedia';
import { Select, Button, MultiSelect, Input, Modal } from '../components/UI';
import { Plus, Trash2, FileText, Save, Mic, StopCircle, List, History, Play, Pause, Calendar, MapPin, ChevronDown, ChevronUp, Search, FlaskConical, Download, AlertTriangle, Square, CheckSquare, FileDown, CheckCircle2, X, Edit, Share2, Split, Copy, PlusCircle, DollarSign, TrendingUp, Wallet, ArrowRight, Info, Sprout, ShoppingCart, ClipboardCheck, LayoutList } from 'lucide-react';
import * as Storage from '../services/storageService';
import * as Export from '../services/exportService';
import { PrescriptionItem, Prescription, PrescriptionTemplate } from '../types';
import { jsPDF } from 'jspdf';
import { WeatherWidget } from '../components/weather/WeatherWidget';
import { TourMode } from '../components/recipes/TourMode';
import { ExecutionMode } from '../components/recipes/ExecutionMode';
import { getUserRole, getRoleColorClass, getRoleBgClass } from '../utils/roleUtils';

// --- SUB-COMPONENT: BUDGET MONITOR (Redesigned) ---
// BudgetMonitor REMOVED

export const RecipesView: React.FC = () => {
    const { data, userCompanies, dataOwnerId, dataOwnerName } = useData();
    const { showNotification } = useUI();
    const { currentUser } = useAuth();
    const [viewMode, setViewMode] = useState<'new' | 'history' | 'tour' | 'execution'>('tour');
    const [isSaving, setIsSaving] = useState(false); // Evita doble-submit

    const { isRecording, audioBlobUrl, audioDuration, toggleRecording, resetRecording } = useMediaRecorder();

    const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
    const [existingAudioUrl, setExistingAudioUrl] = useState<string | null>(null);
    const [existingHasAudio, setExistingHasAudio] = useState<boolean>(false);

    // ROLE CHECK
    const isClient = currentUser?.role === 'company';

    const [selectedCompanyId, setSelectedCompanyId] = useState('');

    // FORCE CLIENT CONTEXT
    React.useEffect(() => {
        if (isClient) {
            // Force view to execution if in restricted views
            if (viewMode === 'new' || viewMode === 'tour') {
                setViewMode('execution');
            }
            // Force company selection
            if (userCompanies.length > 0 && selectedCompanyId !== userCompanies[0].id) {
                setSelectedCompanyId(userCompanies[0].id);
            }
        }
    }, [isClient, viewMode, userCompanies, selectedCompanyId]);
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [selectedPlotIds, setSelectedPlotIds] = useState<string[]>([]);
    const [items, setItems] = useState<PrescriptionItem[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [notes, setNotes] = useState('');

    // Need to infer season for budget calculation. Typically active season.
    const activeSeasonId = useMemo(() => {
        const active = data.seasons.find(s => s.isActive);
        return active ? active.id : (data.seasons.length > 0 ? data.seasons[0].id : '');
    }, [data.seasons]);

    const [currentItemId, setCurrentItemId] = useState('');
    const [currentDose, setCurrentDose] = useState('');
    const [currentUnit, setCurrentUnit] = useState('Lt/Ha');

    // --- TOTAL HECTARES CALCULATION ---
    const totalSelectedHectares = useMemo(() => {
        return selectedPlotIds.reduce((sum, id) => {
            const p = data.plots.find(plot => plot.id === id);
            return sum + (p?.hectares || 0);
        }, 0);
    }, [selectedPlotIds, data.plots]);

    // LIVE BUDGET CALCULATOR REMOVED
    const liveItemCostPerHa = 0;

    // TOTAL RECIPE ESTIMATED COST PER HA REMOVED
    const totalRecipeCostPerHa = 0;

    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);
    const [templateName, setTemplateName] = useState('');
    const [pendingTemplate, setPendingTemplate] = useState<PrescriptionTemplate | null>(null);

    const [historyFilter, setHistoryFilter] = useState({ companyId: '', fieldId: '', dateFrom: '', dateTo: '' });
    const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

    const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [showShoppingList, setShowShoppingList] = useState(false);
    const [fileToShare, setFileToShare] = useState<File | null>(null);

    // Delete State
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'prescription' | 'template' } | null>(null);

    // Split/Conflict State
    const [splitConflict, setSplitConflict] = useState<{
        originalPrescription: Prescription;
        newData: any;
        executedCount: number;
        pendingCount: number;
    } | null>(null);

    // Add Plots State
    const [targetRecipeForAdd, setTargetRecipeForAdd] = useState<Prescription | null>(null);
    const [plotsToAdd, setPlotsToAdd] = useState<string[]>([]);

    const availableFields = data.fields.filter(f => f.companyId === selectedCompanyId);
    const availablePlots = data.plots.filter(p => p.fieldId === selectedFieldId);

    // --- WEATHER LOCATION INFERENCE ---
    const weatherLocation = useMemo(() => {
        const targetFieldId = selectedFieldId;
        const targetCompanyId = selectedCompanyId;

        // Sort monitorings by date desc to find the MOST RECENT location
        const sortedMonitorings = [...data.monitorings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const recent = sortedMonitorings.find(m => {
            if (!m.location) return false;
            if (targetFieldId && m.fieldId !== targetFieldId) return false;
            if (targetCompanyId && m.companyId !== targetCompanyId) return false;
            return true;
        });

        if (recent && recent.location) {
            const f = data.fields.find(field => field.id === recent.fieldId);
            return {
                lat: recent.location.lat,
                lng: recent.location.lng,
                name: f ? f.name : 'Campo'
            };
        }

        // Fallback: Try to find ANY plot with coordinates
        if (targetFieldId) {
            const plotWithLoc = data.plots.find(p => p.fieldId === targetFieldId && p.lat && p.lng);
            if (plotWithLoc && plotWithLoc.lat && plotWithLoc.lng) {
                const f = data.fields.find(field => field.id === targetFieldId);
                return { lat: plotWithLoc.lat, lng: plotWithLoc.lng, name: f ? f.name : 'Campo' };
            }
        }

        if (targetCompanyId) {
            const plotWithLoc = data.plots.find(p => p.companyId === targetCompanyId && p.lat && p.lng);
            if (plotWithLoc && plotWithLoc.lat && plotWithLoc.lng) {
                const field = data.fields.find(f => f.id === plotWithLoc.fieldId);
                return { lat: plotWithLoc.lat, lng: plotWithLoc.lng, name: field ? field.name : 'Campo' };
            }
        }

        return null;
    }, [selectedFieldId, selectedCompanyId, data.monitorings, data.fields, data.plots]);

    // --- SHOPPING LIST CALCULATOR (CONSOLIDATION) ---
    const calculateShoppingList = useMemo((): Record<string, { name: string, quantity: number, unit: string, type: string }[]> => {
        if (selectedRecipeIds.length === 0) return {};

        const selectedRecipes = data.prescriptions.filter(p => selectedRecipeIds.includes(p.id));
        const totals: Record<string, { name: string, quantity: number, unit: string, type: string }> = {};

        // Fix: cast recipe to any to handle unknown properties from Firestore objects safely
        selectedRecipes.forEach((recipe: any) => {
            // Fix: cast recipe to any to handle unknown properties from Firestore objects safely
            const r = recipe as any;
            let recipeHectares = 0;
            // Fix: Ensure plotIds is treated as an array to avoid "unknown" type error
            if (r.plotIds && Array.isArray(r.plotIds)) {
                r.plotIds.forEach((pid: string) => {
                    const plot = data.plots.find(p => p.id === pid);
                    if (plot) recipeHectares += plot.hectares;
                });
            }

            // Fix: Properly handle recipe.items by explicitly casting to any[] to avoid 'unknown' type errors on forEach
            if (r.items && Array.isArray(r.items)) {
                r.items.forEach((item: PrescriptionItem) => {
                    // Normalize Dose
                    const doseVal = parseFloat(item.dose.replace(',', '.'));
                    if (isNaN(doseVal)) return;

                    // Base unit purchasing (Usually just split Lt/Ha -> Lt)
                    const purchaseUnit = item.unit.split('/')[0] || item.unit;
                    const totalNeeded = doseVal * recipeHectares;

                    if (!totals[item.supplyId]) {
                        const product = data.agrochemicals.find(a => a.id === item.supplyId);
                        totals[item.supplyId] = {
                            name: item.supplyName,
                            quantity: 0,
                            unit: purchaseUnit,
                            type: product?.type || 'Otro'
                        };
                    }
                    totals[item.supplyId].quantity += totalNeeded;
                });
            }
        });

        // Group by Type
        const grouped: Record<string, { name: string, quantity: number, unit: string, type: string }[]> = {};
        Object.values(totals).forEach(item => {
            if (!grouped[item.type]) grouped[item.type] = [];
            grouped[item.type].push(item);
        });

        return grouped;
    }, [selectedRecipeIds, data.prescriptions, data.plots, data.agrochemicals]);

    const copyShoppingListToClipboard = () => {
        let text = `🛒 LISTA DE COMPRAS Ing Arg. Msc. Enrique A Marcon (v.1.1)\n`;
        text += `Para ${selectedRecipeIds.length} recetas seleccionadas\n\n`;

        Object.entries(calculateShoppingList).forEach(([type, items]) => {
            text += `*${type.toUpperCase()}*\n`;
            (items as any[]).forEach(item => {
                text += `- ${item.name}: ${item.quantity.toLocaleString('es-AR', { maximumFractionDigits: 2 })} ${item.unit}\n`;
            });
            text += `\n`;
        });

        navigator.clipboard.writeText(text);
        showNotification("Lista copiada al portapapeles", "success");
    };

    // --- PDF GENERATION LOGIC ---
    const generatePDFObject = (): jsPDF => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let yPos = 20;

        const selectedRecipes = data.prescriptions.filter(p => selectedRecipeIds.includes(p.id));

        selectedRecipes.forEach((recipe, index) => {
            if (index > 0) {
                doc.addPage();
                yPos = 20;
            }

            // Header
            doc.setFillColor(22, 163, 74); // Agro Green
            doc.rect(0, 0, pageWidth, 30, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont("helvetica", "bold");
            doc.text("RECETA AGRONÓMICA", margin, 20);

            const recipeDate = new Date(recipe.createdAt).toLocaleDateString();
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`Fecha: ${recipeDate}`, pageWidth - margin, 15, { align: 'right' });
            doc.text("Ing Arg. Msc. Enrique A Marcon (v.1.1)", pageWidth - margin, 22, { align: 'right' });

            // Context Box
            yPos = 40;
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 30, 2, 2, 'FD');

            const companyName = userCompanies.find(c => c.id === recipe.companyId)?.name || "Desconocida";
            const fieldName = data.fields.find(f => f.id === recipe.fieldId)?.name || "Desconocido";

            doc.setTextColor(50, 50, 50);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");

            doc.text("EMPRESA:", margin + 5, yPos + 8);
            doc.text("CAMPO:", margin + 5, yPos + 16);
            doc.text("LOTES:", margin + 5, yPos + 24);

            doc.setFont("helvetica", "normal");
            doc.text(companyName, margin + 35, yPos + 8);
            doc.text(fieldName, margin + 35, yPos + 16);

            // Construct Detailed Plot Names
            const plotsText = recipe.plotIds.map((pid, idx) => {
                const name = recipe.plotNames[idx] || 'Lote';
                const meta = recipe.plotMetadata?.[pid];
                if (meta) {
                    const parts = [];
                    if (meta.affectedHectares) parts.push(`${meta.affectedHectares}ha`);
                    if (meta.observation) parts.push(meta.observation);
                    if (parts.length > 0) return `${name} (${parts.join(', ')})`;
                }
                return name;
            }).join("; ");

            // Truncate if too long (improved multiline handling could be added if needed)
            const splitPlots = doc.splitTextToSize(plotsText, pageWidth - (margin * 2) - 40);
            doc.text(splitPlots, margin + 35, yPos + 24);

            // Adjust Y pos if plots took multiple lines
            yPos += 30 + (splitPlots.length > 1 ? (splitPlots.length - 1) * 5 : 0);


            // Insumos Table Header
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text("PRODUCTO / INSUMO", margin + 5, yPos + 5);
            doc.text("DOSIS", pageWidth - margin - 40, yPos + 5);
            doc.text("UNIDAD", pageWidth - margin - 5, yPos + 5, { align: 'right' });

            yPos += 10;

            // Insumos Rows
            doc.setFont("helvetica", "normal");
            recipe.items.forEach((item) => {
                doc.text(item.supplyName, margin + 5, yPos);
                doc.text(item.dose, pageWidth - margin - 40, yPos);
                doc.text(item.unit, pageWidth - margin - 5, yPos, { align: 'right' });

                doc.setDrawColor(230, 230, 230);
                doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
                yPos += 8;
            });

            yPos += 5;

            // Tasks
            if (recipe.taskNames.length > 0) {
                doc.setFont("helvetica", "bold");
                doc.text("LABORES A REALIZAR:", margin, yPos);
                yPos += 6;
                doc.setFont("helvetica", "normal");
                recipe.taskNames.forEach(task => {
                    doc.text(`• ${task}`, margin + 5, yPos);
                    yPos += 6;
                });
                yPos += 5;
            }

            // Observations & Audio
            if (recipe.notes || recipe.audioUrl) {
                doc.setFont("helvetica", "bold");
                doc.text("OBSERVACIONES:", margin, yPos);
                yPos += 6;

                if (recipe.notes) {
                    doc.setFont("helvetica", "italic");
                    doc.setTextColor(80, 80, 80);
                    const splitNotes = doc.splitTextToSize(recipe.notes, pageWidth - (margin * 2));
                    doc.text(splitNotes, margin + 5, yPos);
                    yPos += (splitNotes.length * 6) + 5;
                }

                if (recipe.audioUrl) {
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(37, 99, 235); // Blue link color
                    // Add link
                    doc.textWithLink("🔊 Escuchar Nota de Voz (Click para abrir)", margin + 5, yPos, { url: recipe.audioUrl });
                    yPos += 10;
                    doc.setTextColor(0, 0, 0); // Reset
                }
            }

            // Signature Area
            const signatureY = 270; // Bottom of page
            doc.setDrawColor(0, 0, 0);
            doc.line(pageWidth / 2 - 40, signatureY, pageWidth / 2 + 40, signatureY);
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text(currentUser?.name || "Ingeniero Responsable", pageWidth / 2, signatureY + 5, { align: 'center' });
        });

        // --- NEW: SHOPPING LIST PAGE ---
        if (Object.keys(calculateShoppingList).length > 0) {
            doc.addPage();
            doc.setFillColor(22, 163, 74); // Agro Green
            doc.rect(0, 0, pageWidth, 30, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont("helvetica", "bold");
            doc.text("LISTA DE COMPRAS CONSOLIDADA", margin, 20);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text("Resumen de Insumos", pageWidth - margin, 20, { align: 'right' });

            yPos = 40;

            // Summary Box
            doc.setDrawColor(200, 200, 200);
            doc.setFillColor(250, 250, 250);
            doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 20, 2, 2, 'FD');

            doc.setTextColor(50, 50, 50);
            doc.setFontSize(10);
            doc.text(`Total de Recetas: ${selectedRecipeIds.length}`, margin + 5, yPos + 12);

            yPos += 30;

            Object.entries(calculateShoppingList).forEach(([type, items]) => {
                // Category Header
                doc.setFillColor(240, 240, 240);
                doc.rect(margin, yPos, pageWidth - (margin * 2), 8, 'F');
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text(type.toUpperCase(), margin + 5, yPos + 6);
                yPos += 12;

                // Table Header
                doc.setFontSize(9);
                doc.text("INSUMO / PRODUCTO", margin + 5, yPos);
                doc.text("CANTIDAD TOTAL", pageWidth - margin - 5, yPos, { align: 'right' });

                doc.setDrawColor(100, 100, 100);
                doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
                yPos += 8;

                // Items
                doc.setFont("helvetica", "normal");
                (items as any[]).forEach((item) => {
                    doc.text(item.name, margin + 5, yPos);
                    const qtyText = `${item.quantity.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.unit}`;
                    doc.text(qtyText, pageWidth - margin - 5, yPos, { align: 'right' });

                    doc.setDrawColor(230, 230, 230);
                    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
                    yPos += 8;
                });

                yPos += 5; // Spacing between categories
            });
        }

        return doc;
    };

    const handleDownload = () => {
        if (selectedRecipeIds.length === 0) return;
        setIsGeneratingPdf(true);
        try {
            const doc = generatePDFObject();
            const dateStr = new Date().toISOString().split('T')[0];
            const fileName = `Recetas_IngMarcon_${dateStr}.pdf`;

            // Use centralized robust download
            const blob = doc.output('blob');
            // Explicitly pass intent to download

            Export.downloadBlob(blob, fileName);

            showNotification("PDF Descargado exitosamente", "success");
            setShowExportOptions(false);
        } catch (error) {
            console.error(error);
            showNotification("Error al generar PDF", "error");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleShare = async () => {
        if (selectedRecipeIds.length === 0) return;
        setIsGeneratingPdf(true);

        const doc = generatePDFObject();
        const fileName = `Recetas_${new Date().toISOString().split('T')[0]}.pdf`;

        try {
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], fileName, { type: "application/pdf" });

            // STEP 1 of 2: Generate and save file, but DON'T share yet (to avoid user gesture timeout)
            setFileToShare(file);
            showNotification("PDF generado. Pulsa 'Enviar Ahora' para compartir.", "success");
        } catch (error: any) {
            console.error("PDF generation error:", error);
            showNotification("Error al generar PDF", "error");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // STEP 2 of 2: Trigger Native Share with Fresh User Gesture
    const triggerNativeShare = async () => {
        if (!fileToShare) return;

        // Debug: Log browser capabilities
        console.log('🔍 Share API Support:', {
            hasNavigatorShare: !!navigator.share,
            hasCanShare: !!navigator.canShare,
            canShareFiles: navigator.canShare ? navigator.canShare({ files: [fileToShare] }) : false,
            browser: navigator.userAgent
        });

        try {
            if (navigator.canShare && navigator.canShare({ files: [fileToShare] })) {
                await navigator.share({
                    files: [fileToShare],
                    title: 'Recetas Agronómicas',
                    text: 'Adjunto recetas agronómicas generadas.',
                });
                showNotification("Compartido exitosamente", "success");
                setShowExportOptions(false);
                setFileToShare(null);
            } else {
                // Fallback for browsers that don't support Web Share API (like Firefox)
                console.warn('⚠️ Web Share API no disponible o no soporta archivos');

                // Auto-download the PDF
                Export.downloadBlob(fileToShare, fileToShare.name);

                // Detect if Firefox (offer helpful shortcuts)
                const isFirefox = navigator.userAgent.includes('Firefox');

                if (isFirefox) {
                    // Show notification with action to open WhatsApp Web or Gmail
                    showNotification(
                        "PDF descargado. Firefox no soporta compartir archivos. Use los botones a continuación para enviar.",
                        "warning"
                    );

                    // Don't close modal - will show alternative buttons instead
                    return; // Keep modal open to show alternative sharing options
                } else {
                    showNotification(
                        "PDF descargado. Para compartir: Adjunte el archivo manualmente en WhatsApp Web o su cliente de email.",
                        "warning"
                    );
                    setShowExportOptions(false);
                    setFileToShare(null);
                }
            }
        } catch (error: any) {
            console.error("Share error:", error);

            if (error.name !== 'AbortError') { // Don't notify on user cancel
                // Fallback: Robust Download
                console.warn('Share failed, falling back to download');
                Export.downloadBlob(fileToShare, fileToShare.name);
                showNotification("Se descargó el PDF. Adjúntelo manualmente en WhatsApp o Email.", "warning");
            }
            setShowExportOptions(false);
            setFileToShare(null);
        }
    };

    const resetForm = () => {
        setEditingRecipeId(null);
        setExistingAudioUrl(null);
        setExistingHasAudio(false);
        setSelectedCompanyId('');
        setSelectedFieldId('');
        setSelectedPlotIds([]);
        setItems([]);
        setSelectedTaskIds([]);
        setNotes('');
        setCurrentItemId('');
        setCurrentDose('');
        resetRecording();
    };

    const switchToNewMode = () => {
        resetForm();
        setViewMode('new');
    };

    const handleEditRecipe = (recipe: Prescription, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingRecipeId(recipe.id);
        setSelectedCompanyId(recipe.companyId);
        setSelectedFieldId(recipe.fieldId);
        setSelectedPlotIds(recipe.plotIds);
        setItems([...(recipe.items || [])]);
        setSelectedTaskIds([...(recipe.taskIds || [])]);
        setNotes(recipe.notes);
        setExistingAudioUrl(recipe.audioUrl || null);
        setExistingHasAudio(recipe.hasAudio || false);
        setViewMode('new');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCloneRecipe = (recipe: Prescription, e: React.MouseEvent) => {
        e.stopPropagation();
        resetForm();
        setItems([...(recipe.items || [])]);
        setSelectedTaskIds([...(recipe.taskIds || [])]);
        setNotes(recipe.notes);
        setSelectedCompanyId(recipe.companyId);
        setViewMode('new');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        showNotification("Receta clonada. Seleccione el nuevo campo/lotes.", "success");
    };

    const handleOpenAddPlotModal = (recipe: Prescription, e: React.MouseEvent) => {
        e.stopPropagation();
        setTargetRecipeForAdd(recipe);
        setPlotsToAdd([]);
    };

    const handleConfirmAddPlots = async () => {
        if (!targetRecipeForAdd || plotsToAdd.length === 0) return;
        const newPlotNames = plotsToAdd.map(pid => data.plots.find(p => p.id === pid)?.name || 'Lote');
        await Storage.addPlotsToPrescription(targetRecipeForAdd.id, plotsToAdd, newPlotNames);
        showNotification(`${plotsToAdd.length} lotes sumados a la receta.`, "success");
        setTargetRecipeForAdd(null);
        setPlotsToAdd([]);
    };

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) { showNotification("Ingrese un nombre para la plantilla", "error"); return; }
        if (items.length === 0 && selectedTaskIds.length === 0) { showNotification("La plantilla está vacía", "error"); return; }
        if (!dataOwnerId) return;
        await Storage.addPrescriptionTemplate({
            name: templateName,
            items,
            taskIds: selectedTaskIds,
            notes,
            ownerId: dataOwnerId
        });
        showNotification("Plantilla guardada", "success");
        setIsTemplateModalOpen(false);
        setTemplateName('');
    };

    const handleSelectTemplate = (templateId: string) => {
        if (!templateId) return;
        const tmpl = data.templates.find(t => t.id === templateId);
        if (tmpl) {
            setPendingTemplate(tmpl);
            setIsTemplateDropdownOpen(false);
        }
    };

    const confirmLoadTemplate = () => {
        if (!pendingTemplate) return;
        setItems(pendingTemplate.items ? [...pendingTemplate.items] : []);
        setSelectedTaskIds(pendingTemplate.taskIds ? [...pendingTemplate.taskIds] : []);
        setNotes(pendingTemplate.notes || '');
        showNotification("Plantilla cargada exitosamente", "success");
        setPendingTemplate(null);
    };

    const handleDeleteTemplateClick = (templateId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteTarget({ id: templateId, type: 'template' });
    };

    const handleDeletePrescriptionClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setDeleteTarget({ id, type: 'prescription' });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        if (deleteTarget.type === 'template') {
            await Storage.deletePrescriptionTemplate(deleteTarget.id);
            showNotification("Plantilla eliminada", "success");
        } else {
            await Storage.deletePrescription(deleteTarget.id);
            showNotification("Receta eliminada", "success");
            setSelectedRecipeIds(prev => prev.filter(pid => pid !== deleteTarget.id));
        }
        setDeleteTarget(null);
    };

    const handleAddItem = () => {
        if (!currentItemId || !currentDose) return;
        const supply = data.agrochemicals.find(a => a.id === currentItemId);
        if (!supply) return;
        const newItem: PrescriptionItem = { supplyId: supply.id, supplyName: supply.name, dose: currentDose, unit: currentUnit };
        setItems([...items, newItem]);
        setCurrentItemId(''); setCurrentDose('');
    };

    const handleRemoveItem = (index: number) => { const newItems = [...items]; newItems.splice(index, 1); setItems(newItems); };
    const handleRemoveTask = (taskId: string) => { setSelectedTaskIds(prev => prev.filter(id => id !== taskId)); };

    const handleSavePrescription = async () => {
        if (isSaving) return; // Evita doble-submit
        if (!selectedCompanyId || !selectedFieldId || selectedPlotIds.length === 0) { showNotification("Seleccione el contexto completo", "error"); return; }
        if (items.length === 0 && selectedTaskIds.length === 0) { showNotification("Agregue insumos o tareas", "error"); return; }
        if (!dataOwnerId) return;

        setIsSaving(true);
        try {
            const plotNames = selectedPlotIds.map(pid => data.plots.find(p => p.id === pid)?.name || 'Desconocido');
            const taskNames = selectedTaskIds.map(tid => data.tasks.find(t => t.id === tid)?.name || 'Desconocido');

            const itemsWithSnapshot = items.map(item => {
                const product = data.agrochemicals.find(a => a.id === item.supplyId);
                return {
                    ...item,
                    lockedPrice: product?.price || 0
                };
            });

            const prescriptionData = {
                createdAt: Date.now(), // Timestamp numérico (igual que monitorings)
                companyId: selectedCompanyId,
                fieldId: selectedFieldId,
                plotIds: selectedPlotIds,
                plotNames,
                items: itemsWithSnapshot,
                taskIds: selectedTaskIds,
                taskNames,
                notes,
                status: 'active' as const,
                ownerId: dataOwnerId,
                ownerName: dataOwnerName,
                audioUrl: audioBlobUrl ? undefined : (existingAudioUrl || null),
                audioDuration: audioDuration > 0 ? audioDuration : undefined,
                hasAudio: (audioDuration > 0 || !!existingAudioUrl) // Flag permanente como en monitorings
            };

            if (editingRecipeId) {
                const original = data.prescriptions.find(p => p.id === editingRecipeId);
                if (original && original.executionData) {
                    const executedPlotIds = Object.keys(original.executionData).filter(pid => original.executionData![pid].executed);
                    if (executedPlotIds.length > 0) {
                        const pendingPlotsInSelection = selectedPlotIds.filter(pid => !executedPlotIds.includes(pid));
                        if (pendingPlotsInSelection.length > 0) {
                            setSplitConflict({
                                originalPrescription: original,
                                newData: prescriptionData,
                                executedCount: executedPlotIds.length,
                                pendingCount: pendingPlotsInSelection.length
                            });
                            setIsSaving(false); // Resetear estado antes de return
                            return;
                        }
                    }
                }
                await Storage.updatePrescription(editingRecipeId, prescriptionData, audioBlobUrl || undefined);
                showNotification("Receta actualizada exitosamente", "success");
            } else {
                await Storage.addPrescription(prescriptionData, audioBlobUrl || undefined);
                showNotification("Receta creada exitosamente", "success");
            }
            resetForm();
            setViewMode('history');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSplitConfirm = async () => {
        if (!splitConflict) return;
        const originalExecutedIds = Object.keys(splitConflict.originalPrescription.executionData || {})
            .filter(pid => splitConflict.originalPrescription.executionData![pid].executed);

        const plotsForNewRecipe = splitConflict.newData.plotIds.filter((pid: string) => !originalExecutedIds.includes(pid));

        if (plotsForNewRecipe.length === 0) {
            showNotification("No hay lotes pendientes seleccionados para la nueva receta.", "error");
            setSplitConflict(null);
            return;
        }

        await Storage.splitPrescription(
            splitConflict.originalPrescription.id,
            splitConflict.originalPrescription,
            splitConflict.newData,
            plotsForNewRecipe,
            audioBlobUrl || undefined
        );

        showNotification("Receta dividida exitosamente. Historial preservado.", "success");
        setSplitConflict(null);
        resetForm();
        setViewMode('history');
    };

    const handleOverwriteConfirm = async () => {
        if (!splitConflict || !editingRecipeId) return;
        const dataWithNote = {
            ...splitConflict.newData,
            notes: splitConflict.newData.notes + "\n[ALERTA: Editado post-ejecución]"
        };
        await Storage.updatePrescription(editingRecipeId, dataWithNote, audioBlobUrl || undefined);
        showNotification("Receta sobrescrita (Historial alterado)", "warning");
        setSplitConflict(null);
        resetForm();
        setViewMode('history');
    };

    const filteredHistory = useMemo(() => {
        const result = data.prescriptions.filter(p => {
            if (!p) return false;
            if (historyFilter.companyId && p.companyId !== historyFilter.companyId) return false;
            if (historyFilter.fieldId && p.fieldId !== historyFilter.fieldId) return false;

            if (historyFilter.dateFrom) {
                const pDate = p.createdAt || 0;
                const fDate = new Date(historyFilter.dateFrom).getTime();
                if (pDate < fDate) return false;
            }
            if (historyFilter.dateTo) {
                const pDate = p.createdAt || 0;
                const tDate = new Date(historyFilter.dateTo);
                tDate.setHours(23, 59, 59);
                if (pDate > tDate.getTime()) return false;
            }
            return true;
        });

        return result.sort((a, b) => {
            const dateA = a.createdAt || 0;
            const dateB = b.createdAt || 0;
            return dateB - dateA;
        });
    }, [data.prescriptions, historyFilter]);

    // Enriquecer recetas con audio offline de IndexedDB
    const enrichedHistory = useOfflinePrescriptions(filteredHistory);

    const toggleAudio = (url: string, id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (playingAudioId === id) {
            setPlayingAudioId(null);
            const audio = document.getElementById(`audio-recipe-${id}`) as HTMLAudioElement;
            if (audio) audio.pause();
        } else {
            setPlayingAudioId(id);
            const audio = document.getElementById(`audio-recipe-${id}`) as HTMLAudioElement;
            if (audio) { audio.play().catch(console.error); audio.onended = () => setPlayingAudioId(null); }
        }
    };

    const toggleRecipeSelection = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectedRecipeIds.includes(id)) {
            setSelectedRecipeIds(selectedRecipeIds.filter(rid => rid !== id));
        } else {
            setSelectedRecipeIds([...selectedRecipeIds, id]);
        }
    };

    const selectAllFiltered = () => {
        if (selectedRecipeIds.length === enrichedHistory.length) {
            setSelectedRecipeIds([]);
        } else {
            setSelectedRecipeIds(enrichedHistory.map(r => r.id || r._operationId));
        }
    };

    const formatDate = (timestamp: number | string) => {
        if (!timestamp) return '-';
        const d = new Date(timestamp);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    if (!currentUser) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <FileText className="w-6 h-6 text-agro-600" />
                    {editingRecipeId ? 'Editar Receta' : 'Gestión de Recetas'}
                </h2>
                <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mb-6 self-start">
                    {!isClient && (
                        <>
                            {/* <button onClick={() => setViewMode('new')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'new' ? 'bg-white dark:bg-gray-700 text-agro-600 dark:text-agro-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>INDIVIDUAL</button> */}
                            <button onClick={() => setViewMode('tour')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'tour' ? 'bg-white dark:bg-gray-700 text-agro-600 dark:text-agro-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>RECORRIDA</button>
                        </>
                    )}
                    <button onClick={() => setViewMode('execution')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'execution' ? 'bg-white dark:bg-gray-700 text-agro-600 dark:text-agro-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>EJECUCIÓN</button>
                    <button onClick={() => setViewMode('history')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-white dark:bg-gray-700 text-agro-600 dark:text-agro-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>HISTORIAL</button>
                </div>
            </div>

            {viewMode === 'tour' && (
                <TourMode
                    onCancel={() => setViewMode('new')}
                    onFinish={() => setViewMode('history')}
                />
            )}

            {viewMode === 'execution' && (
                <ExecutionMode
                    onBack={() => setViewMode('new')}
                    forcedCompanyId={isClient ? selectedCompanyId : undefined}
                />
            )}

            {viewMode === 'new' && (
                <div className="space-y-6 animate-fade-in">
                    {editingRecipeId && (
                        <div className="bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 p-3 rounded-lg border border-amber-200 dark:border-amber-800 flex justify-between items-center">
                            <span className="text-sm font-medium">Estás editando una receta existente.</span>
                            <button onClick={resetForm} className="text-xs underline hover:text-amber-900">Cancelar Edición</button>
                        </div>
                    )}

                    {weatherLocation && (
                        <div className="mb-4">
                            <WeatherWidget
                                lat={weatherLocation.lat}
                                lng={weatherLocation.lng}
                                locationName={weatherLocation.name}
                            />
                        </div>
                    )}

                    {!editingRecipeId && (
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                <Download className="w-5 h-5" />
                                <span className="font-bold text-sm">Cargar Plantilla Rápida</span>
                            </div>
                            <div className="flex-1 w-full md:max-w-md relative">
                                <button onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)} className="w-full flex justify-between items-center px-3 py-2 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-gray-700 dark:text-gray-200">
                                    <span>Seleccionar plantilla...</span>
                                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isTemplateDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isTemplateDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsTemplateDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                            {data.templates.length === 0 ? (
                                                <div className="p-3 text-sm text-gray-500 text-center italic">No hay plantillas guardadas.</div>
                                            ) : (
                                                data.templates.map(t => (
                                                    <div key={t.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 group border-b last:border-0 border-gray-100 dark:border-gray-700/50">
                                                        <div className="flex-1 cursor-pointer flex flex-col" onClick={() => handleSelectTemplate(t.id)}>
                                                            <span className="font-medium text-gray-800 dark:text-white text-sm">{t.name}</span>
                                                            <span className="text-[10px] text-gray-500">{t.items.length} insumos, {t.taskIds.length} labores</span>
                                                        </div>
                                                        <button onClick={(e) => handleDeleteTemplateClick(t.id, e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors" title="Eliminar plantilla"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                            {data.templates.length > 0 && (
                                <span className="text-xs text-blue-500 dark:text-blue-400 hidden md:inline">{data.templates.length} disponibles</span>
                            )}
                        </div>
                    )}

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 border-b pb-2">1. Selección de Lotes</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <Select label="Empresa" options={userCompanies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => ({ value: c.id, label: c.name }))} value={selectedCompanyId} onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedFieldId(''); setSelectedPlotIds([]); }} placeholder="Seleccionar Empresa..." disabled={isClient} />
                            <Select label="Campo" options={availableFields.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => ({ value: f.id, label: f.name }))} value={selectedFieldId} onChange={(e) => { setSelectedFieldId(e.target.value); setSelectedPlotIds([]); }} disabled={!selectedCompanyId} placeholder="Seleccionar Campo..." />
                        </div>
                        {selectedFieldId && (
                            <MultiSelect label="Lotes a Aplicar" options={availablePlots.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(p => ({ value: p.id, label: p.name }))} selectedValues={selectedPlotIds} onChange={setSelectedPlotIds} placeholder="Seleccionar Lotes..." />
                        )}
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 border-b pb-2">2. Insumos / Productos</h3>

                        {/* LIVE ADDER */}
                        <div className="flex flex-col md:flex-row gap-3 items-end bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg mb-4">
                            <div className="flex-1 w-full">
                                <Select
                                    label="Insumo"
                                    options={data.agrochemicals.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(a => ({ value: a.id, label: `${a.name} (${a.type})` }))}
                                    value={currentItemId}
                                    onChange={(e) => {
                                        const id = e.target.value;
                                        setCurrentItemId(id);
                                        const supply = data.agrochemicals.find(a => a.id === id);
                                        if (supply) {
                                            if (supply.priceUnit === 'Kg') setCurrentUnit('Kg/Ha');
                                            else setCurrentUnit('Lt/Ha');
                                        }
                                    }}
                                    placeholder="Buscar producto..."
                                />
                            </div>
                            <div className="w-full md:w-48"><Input label="Dosis" value={currentDose} onChange={(e) => setCurrentDose(e.target.value)} placeholder="Ej: 2.5" /></div>
                            <div className="w-full md:w-32"><Input label="Unidad" value={currentUnit} disabled={true} readOnly /></div>

                            <div className="flex items-center gap-2">
                                <Button onClick={handleAddItem} disabled={!currentItemId || !currentDose}><Plus className="w-4 h-4" /></Button>
                            </div>
                        </div>

                        {/* RECEIPT LIST */}
                        {items.length > 0 ? (
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs text-gray-500 uppercase font-semibold">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Producto</th>
                                            <th className="px-4 py-2 text-right">Dosis</th>
                                            <th className="px-4 py-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{(items as PrescriptionItem[]).map((item, idx) => {
                                        return (
                                            <tr key={idx} className="bg-white dark:bg-gray-800">
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">{item.supplyName}</td>
                                                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{item.dose} {item.unit}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button onClick={() => handleRemoveItem(idx)} className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        ) : <p className="text-sm text-gray-400 text-center italic py-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg border border-dashed border-gray-200 dark:border-gray-700">No hay insumos agregados.</p>}
                    </div>

                    {/* --- BUDGET MONITOR REMOVED --- */}

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 border-b pb-2">3. Labores e Indicaciones</h3>
                        <div className="space-y-4">
                            <MultiSelect label="Tareas a Realizar" options={data.tasks.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(t => ({ value: t.id, label: t.name }))} selectedValues={selectedTaskIds} onChange={setSelectedTaskIds} placeholder="Seleccionar labores..." />
                            {selectedTaskIds.length > 0 && (
                                <div className="space-y-2 mt-2">
                                    {selectedTaskIds.map((taskId) => {
                                        const task = data.tasks.find(t => t.id === taskId);
                                        if (!task) return null;
                                        return (
                                            <div key={taskId} className="flex justify-between items-center p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm animate-fade-in">
                                                <span className="font-bold text-gray-800 dark:text-white">{task.name}</span>
                                                <button onClick={() => handleRemoveTask(taskId)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="flex flex-col md:flex-row gap-4 pt-4">
                                <div className="flex-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Observaciones Generales</label>
                                    <textarea className="w-full mt-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 dark:text-white h-24 focus:ring-2 focus:ring-agro-500 outline-none resize-none" placeholder="Indicaciones..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                                </div>
                                <div className="w-full md:w-auto flex flex-col justify-end">
                                    <div onClick={toggleRecording} className={`border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl h-24 w-full md:w-32 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isRecording ? 'border-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}>
                                        {isRecording ? <div className="flex flex-col items-center animate-pulse text-red-500"><StopCircle className="w-6 h-6 mb-1" /><span className="text-xs font-bold">{audioDuration}s</span></div> : <div className="flex flex-col items-center text-gray-400"><Mic className={`w-6 h-6 mb-1 ${(audioDuration > 0 || (editingRecipeId && existingHasAudio)) ? 'text-green-500' : ''}`} /><span className="text-xs text-center">{(audioDuration > 0 || (editingRecipeId && existingHasAudio)) ? 'Audio OK' : 'Grabar Nota'}</span></div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-between pt-4 items-center">
                        {!editingRecipeId ? (
                            <Button variant="secondary" onClick={() => setIsTemplateModalOpen(true)}>Guardar como Plantilla</Button>
                        ) : (
                            <Button variant="ghost" onClick={resetForm}>Cancelar</Button>
                        )}
                        <Button onClick={handleSavePrescription} disabled={isSaving} className="px-8 py-3 text-lg">
                            <Save className="w-5 h-5 mr-2" />
                            {isSaving ? 'Guardando...' : (editingRecipeId ? 'Actualizar Receta' : 'Guardar Receta')}
                        </Button>
                    </div>
                </div>
            )}

            {viewMode === 'history' && (
                <div className="space-y-4 animate-fade-in relative">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-5 gap-2">
                        <input type="date" className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-xs dark:text-white" value={historyFilter.dateFrom} onChange={e => setHistoryFilter({ ...historyFilter, dateFrom: e.target.value })} placeholder="Desde" />
                        <input type="date" className="w-full px-3 py-2 border rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700 text-xs dark:text-white" value={historyFilter.dateTo} onChange={e => setHistoryFilter({ ...historyFilter, dateTo: e.target.value })} placeholder="Hasta" />
                        <Select label="" options={userCompanies.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(c => ({ value: c.id, label: c.name }))} value={historyFilter.companyId} onChange={e => setHistoryFilter({ ...historyFilter, companyId: e.target.value, fieldId: '' })} placeholder="Empresa..." className="text-xs py-2" />
                        <Select label="" options={data.fields.filter(f => f.companyId === historyFilter.companyId).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(f => ({ value: f.id, label: f.name }))} value={historyFilter.fieldId} onChange={e => setHistoryFilter({ ...historyFilter, fieldId: e.target.value })} disabled={!historyFilter.companyId} placeholder="Campo..." className="text-xs py-2" />
                        <Button variant="ghost" onClick={() => setHistoryFilter({ companyId: '', fieldId: '', dateFrom: '', dateTo: '' })} className="text-xs">Limpiar</Button>
                    </div>

                    {enrichedHistory.length > 0 && (
                        <div className="flex items-center px-2 py-1">
                            <button onClick={selectAllFiltered} className="flex items-center text-xs font-bold text-gray-500 hover:text-agro-600 transition-colors">
                                {selectedRecipeIds.length === enrichedHistory.length && enrichedHistory.length > 0 ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
                                {selectedRecipeIds.length === enrichedHistory.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                            </button>
                        </div>
                    )}

                    <div className="space-y-3 pb-24">
                        {enrichedHistory.length === 0 ? (
                            <div className="text-center py-12 text-gray-400 dark:text-gray-500"><Search className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No se encontraron recetas.</p></div>
                        ) : enrichedHistory.map((recipe: any) => {
                            const recipeId = recipe.id || recipe._operationId;
                            const isExpanded = expandedRecipeId === recipeId;
                            const isSelected = selectedRecipeIds.includes(recipeId);
                            const fieldName = data.fields.find(f => f.id === recipe.fieldId)?.name || 'Campo desconocido';
                            const companyName = userCompanies.find(c => c.id === recipe.companyId)?.name || '';

                            return (
                                <div key={recipeId} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all overflow-hidden ${isSelected ? 'border-agro-500 ring-1 ring-agro-500 bg-agro-50 dark:bg-gray-800' : 'border-gray-200 dark:border-gray-700'}`}>
                                    <div className="flex">
                                        <div className="w-12 flex items-center justify-center cursor-pointer border-r border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={(e) => toggleRecipeSelection(recipeId, e)}>
                                            {isSelected ? <CheckSquare className="w-5 h-5 text-agro-600" /> : <Square className="w-5 h-5 text-gray-300 dark:text-gray-600" />}
                                        </div>
                                        <div className="flex-1 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50" onClick={() => setExpandedRecipeId(isExpanded ? null : recipeId)}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-bold text-gray-800 dark:text-white text-lg">{fieldName}</span>
                                                        <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">{companyName}</span>
                                                    </div>
                                                    <div className="flex items-center text-xs text-gray-500 gap-3">
                                                        <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />{formatDate(recipe.createdAt)}</span>
                                                        <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{(recipe.plotIds as string[])?.length || 0} Lotes</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {recipe.hasAudio && recipe.audioUrl && (
                                                        <button onClick={(e) => toggleAudio(recipe.audioUrl!, recipeId, e)} className={`p-2 rounded-full border ${playingAudioId === recipeId ? 'bg-green-100 text-green-600 border-green-300' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                                            {playingAudioId === recipeId ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                                            <audio id={`audio-recipe-${recipeId}`} src={recipe.audioUrl} className="hidden" />
                                                        </button>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                <span className="text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border border-blue-100 dark:border-blue-800 flex items-center">
                                                    <FlaskConical className="w-3 h-3 mr-1" /> {recipe.items?.length || 0} Insumos
                                                </span>
                                                <span className="text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-2 py-1 rounded border border-purple-100 dark:border-purple-800 flex items-center">
                                                    <List className="w-3 h-3 mr-1" /> {recipe.taskIds?.length || 0} Labores
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    {isExpanded && (
                                        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-4 text-sm animate-fade-in pl-16">
                                            <div className="mb-4">
                                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-xs uppercase flex justify-between">
                                                    <span>Estado de Aplicación ({Object.keys(recipe.executionData || {}).filter(k => recipe.executionData![k]?.executed).length}/{recipe.plotIds.length})</span>
                                                    {(() => {
                                                        const executedCount = Object.keys(recipe.executionData || {}).filter(k => recipe.executionData![k]?.executed).length;
                                                        const total = recipe.plotIds.length;
                                                        if (executedCount === 0) return <span className="text-amber-500 font-bold text-[10px]">PENDIENTE</span>;
                                                        if (executedCount === total) return <span className="text-green-600 font-bold text-[10px]">COMPLETADO</span>;
                                                        return <span className="text-blue-500 font-bold text-[10px]">PARCIAL</span>;
                                                    })()}
                                                </h4>

                                                <div className="space-y-2 mt-2">
                                                    {(recipe.plotIds as string[]).map((pid, idx) => {
                                                        const plotName = (recipe.plotNames?.[idx] || 'Lote');
                                                        const exec = recipe.executionData?.[pid];
                                                        const isDone = exec?.executed;

                                                        return (
                                                            <div key={pid} className={`p-3 rounded-lg border text-sm ${isDone ? 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800' : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex items-center gap-2">
                                                                        {isDone ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4 text-gray-300" />}
                                                                        <span className={`font-medium ${isDone ? 'text-green-800 dark:text-green-300' : 'text-gray-500'}`}>{plotName}</span>
                                                                    </div>
                                                                    {isDone && (
                                                                        <div className="text-right">
                                                                            <span className="block text-[10px] text-gray-400">{formatDate(exec.executedAt || '')}</span>
                                                                            <span className="block text-[10px] font-bold text-gray-600 dark:text-gray-400">{exec.executedBy}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isDone && (exec.observation || exec.audioUrl) && (
                                                                    <div className="mt-2 pl-6 text-xs text-gray-600 dark:text-gray-400">
                                                                        {exec.observation && <p className="italic">"{exec.observation}"</p>}
                                                                        {exec.audioUrl && (
                                                                            <div className="flex items-center gap-2 mt-1 text-blue-500 cursor-pointer hover:underline" onClick={(e) => toggleAudio(exec.audioUrl!, pid, e)}>
                                                                                <div className={`p-1 rounded-full border ${playingAudioId === pid ? 'bg-blue-100 border-blue-300' : 'bg-white border-blue-200'}`}>
                                                                                    {playingAudioId === pid ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                                                                </div>
                                                                                <span>Nota de voz ({exec.audioDuration ? Math.round(exec.audioDuration) + 's' : 'Audio'})</span>
                                                                                <audio id={`audio-recipe-${pid}`} src={exec.audioUrl} className="hidden" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="mb-4">
                                                <h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-xs uppercase">Detalle de Insumos</h4>
                                                <div className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                    <table className="w-full text-left">
                                                        <thead className="bg-gray-50 dark:bg-gray-700 text-xs text-gray-500"><tr><th className="px-3 py-2">Producto</th><th className="px-3 py-2 text-right">Dosis</th></tr></thead>
                                                        {/* Fix: Explicitly cast recipe.items to PrescriptionItem[] to avoid "unknown" type error during mapping */}
                                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{(recipe.items as PrescriptionItem[])?.map((it, idx) => (<tr key={idx}><td className="px-3 py-2 dark:text-gray-200">{it.supplyName}</td><td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400">{it.dose} {it.unit}</td></tr>))}</tbody>
                                                    </table>
                                                </div>
                                            </div>
                                            {(recipe.taskIds as string[])?.length > 0 && (
                                                <div className="mb-4"><h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-xs uppercase">Labores</h4><ul className="list-disc list-inside text-gray-600 dark:text-gray-400">{(recipe.taskNames as string[])?.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
                                            )}
                                            {recipe.notes && (
                                                <div className="mb-4"><h4 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-xs uppercase">Observaciones</h4><p className={`bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-700 italic ${getRoleColorClass(getUserRole(recipe.ownerId, data.users, dataOwnerId))}`}>{recipe.notes}</p></div>
                                            )}
                                            {!isClient && (
                                                <div className="flex justify-end pt-2 gap-2 flex-wrap">
                                                    <button onClick={(e) => handleOpenAddPlotModal(recipe, e)} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-xs flex items-center font-medium px-3 py-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors" title="Agregar lotes del mismo campo"><PlusCircle className="w-4 h-4 mr-1" /> Sumar Lotes</button>
                                                    <button onClick={(e) => handleCloneRecipe(recipe, e)} className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 text-xs flex items-center font-medium px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors" title="Copiar receta a otro campo"><Copy className="w-4 h-4 mr-1" /> Clonar</button>
                                                    <button onClick={(e) => handleEditRecipe(recipe, e)} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs flex items-center font-medium px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"><Edit className="w-4 h-4 mr-1" /> Editar</button>
                                                    <button onClick={(e) => handleDeletePrescriptionClick(e, recipe.id || recipe._operationId)} className="text-red-500 hover:text-red-700 text-xs flex items-center font-medium px-3 py-2 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4 mr-1" /> Eliminar</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {selectedRecipeIds.length > 0 && (
                        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-6 animate-bounce-in">
                            <span className="font-bold text-sm">{selectedRecipeIds.length} seleccionados</span>
                            <div className="h-6 w-px bg-gray-700"></div>
                            <button onClick={() => setShowShoppingList(true)} className="flex items-center font-bold text-sm hover:text-green-400 transition-colors" title="Consolidar Compras"><ShoppingCart className="w-4 h-4 mr-2" /> Lista de Compras</button>
                            <div className="h-6 w-px bg-gray-700"></div>
                            <button onClick={() => setShowExportOptions(true)} className="flex items-center font-bold text-sm hover:text-agro-400 transition-colors"><FileDown className="w-4 h-4 mr-2" />Generar PDF</button>
                            <button onClick={() => setSelectedRecipeIds([])} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>
            )}

            {/* --- MODALS --- */}

            <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} title="Guardar como Plantilla">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Guarde la configuración actual de insumos y labores para reutilizarla rápidamente en el futuro.</p>
                    <Input label="Nombre de la Plantilla" placeholder="Ej: Barbecho Soja" value={templateName} onChange={(e) => setTemplateName(e.target.value)} autoFocus />
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setIsTemplateModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveTemplate}>Guardar</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!pendingTemplate} onClose={() => setPendingTemplate(null)} title="Cargar Plantilla">
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-100 dark:border-amber-800/50">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <p className="text-sm">Esto reemplazará todos los insumos y labores que haya cargado actualmente en el formulario.</p>
                    </div>
                    <div className="text-center py-2"><p className="text-gray-600 dark:text-gray-300 text-sm">¿Desea cargar la plantilla <strong>"{pendingTemplate?.name}"</strong>?</p></div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setPendingTemplate(null)}>Cancelar</Button>
                        <Button onClick={confirmLoadTemplate}>Sí, Cargar</Button>
                    </div>
                </div>
            </Modal>

            {/* Add Plot Modal */}
            <Modal isOpen={!!targetRecipeForAdd} onClose={() => setTargetRecipeForAdd(null)} title="Sumar Lotes a Receta">
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Seleccione los lotes adicionales del campo <strong>{data.fields.find(f => f.id === targetRecipeForAdd?.fieldId)?.name}</strong> que desea agregar a esta receta.
                    </p>
                    {targetRecipeForAdd && (
                        <MultiSelect
                            label="Lotes Disponibles"
                            options={data.plots
                                .filter(p => p.fieldId === targetRecipeForAdd.fieldId && !targetRecipeForAdd.plotIds.includes(p.id))
                                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
                                .map(p => ({ value: p.id, label: p.name }))}
                            selectedValues={plotsToAdd}
                            onChange={setPlotsToAdd}
                            placeholder="Seleccionar lotes..."
                        />
                    )}
                    {targetRecipeForAdd && data.plots.filter(p => p.fieldId === targetRecipeForAdd.fieldId && !targetRecipeForAdd.plotIds.includes(p.id)).length === 0 && (
                        <p className="text-xs text-amber-500 italic">No hay más lotes disponibles en este campo.</p>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setTargetRecipeForAdd(null)}>Cancelar</Button>
                        <Button onClick={handleConfirmAddPlots} disabled={plotsToAdd.length === 0}>Confirmar</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showExportOptions} onClose={() => { setShowExportOptions(false); setFileToShare(null); }} title="Exportar PDF">
                <div className="space-y-4">
                    {!fileToShare ? (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-4">¿Qué desea hacer con las recetas seleccionadas?</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button onClick={handleDownload} disabled={isGeneratingPdf} className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-agro-500 hover:bg-agro-50 dark:hover:bg-gray-700 transition-all group">
                                    <Download className="w-8 h-8 text-gray-500 dark:text-gray-400 group-hover:text-agro-600 mb-2" />
                                    <span className="font-bold text-gray-800 dark:text-white">Descargar</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Guardar en dispositivo</span>
                                </button>
                                <button onClick={handleShare} disabled={isGeneratingPdf} className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-green-500 hover:bg-green-50 dark:hover:bg-gray-700 transition-all group">
                                    <Share2 className="w-8 h-8 text-gray-500 dark:text-gray-400 group-hover:text-green-600 mb-2" />
                                    <span className="font-bold text-gray-800 dark:text-white">Compartir</span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Enviar por WhatsApp/Email</span>
                                </button>
                            </div>
                            {isGeneratingPdf && <div className="text-center text-sm text-agro-600 mt-2 font-medium animate-pulse">Generando documento...</div>}
                        </>
                    ) : (
                        <div className="space-y-4 animate-fade-in">
                            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg border border-green-200 dark:border-green-800">
                                <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <div>
                                    <p className="font-bold text-sm">PDF Generado y Descargado</p>
                                    <p className="text-xs">Archivo guardado en su carpeta de Descargas</p>
                                </div>
                            </div>

                            {/* Show share button for browsers that support it, or alternative buttons for Firefox */}
                            {navigator.share ? (
                                <button onClick={triggerNativeShare} className="w-full flex items-center justify-center gap-2 p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold transition-all shadow-lg shadow-green-500/30">
                                    <Share2 className="w-5 h-5" />
                                    Enviar Ahora
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-center text-amber-600 dark:text-amber-400 font-medium">
                                        Su navegador no soporta compartir archivos. Use estas alternativas:
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => window.open('https://web.whatsapp.com/', '_blank')}
                                            className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-all group"
                                        >
                                            <svg className="w-8 h-8 text-green-600 mb-2" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                                            </svg>
                                            <span className="text-xs font-bold text-gray-800 dark:text-white">WhatsApp Web</span>
                                        </button>
                                        <button
                                            onClick={() => window.open('https://mail.google.com/mail/?view=cm&fs=1&tf=1', '_blank')}
                                            className="flex flex-col items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-all group"
                                        >
                                            <svg className="w-8 h-8 text-red-600 mb-2" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
                                            </svg>
                                            <span className="text-xs font-bold text-gray-800 dark:text-white">Gmail</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">
                                        El PDF fue descargado. Adjúntelo manualmente en la app que abra.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex justify-end pt-2"><Button variant="ghost" onClick={() => { setShowExportOptions(false); setFileToShare(null); }} disabled={isGeneratingPdf}>Cancelar</Button></div>
                </div>
            </Modal>

            {/* SHOPPING LIST MODAL */}
            <Modal isOpen={showShoppingList} onClose={() => setShowShoppingList(false)} title="Consolidado de Insumos">
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                        <div className="text-sm">
                            <span className="text-gray-500 dark:text-gray-400 block text-xs uppercase font-bold">Base del cálculo</span>
                            <span className="font-bold text-gray-800 dark:text-white">{selectedRecipeIds.length} Recetas Seleccionadas</span>
                        </div>
                        <Button variant="secondary" onClick={copyShoppingListToClipboard} className="text-xs h-8">
                            <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar para WhatsApp
                        </Button>
                    </div>

                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                        {Object.entries(calculateShoppingList).map(([type, items]) => (
                            <div key={type} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 font-bold text-xs uppercase text-gray-600 dark:text-gray-300">
                                    {type}
                                </div>
                                <div className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
                                    {(items as any[]).map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center px-3 py-2 text-sm">
                                            <span className="font-medium text-gray-800 dark:text-gray-200">{item.name}</span>
                                            <span className="font-mono font-bold text-agro-600 dark:text-agro-400">
                                                {item.quantity.toLocaleString('es-AR', { maximumFractionDigits: 2 })} <span className="text-gray-400 text-xs font-normal ml-0.5">{item.unit}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="ghost" onClick={() => setShowShoppingList(false)}>Cerrar</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={deleteTarget?.type === 'template' ? "Eliminar Plantilla" : "Eliminar Receta"}>
                <div className="space-y-4">
                    <p className="text-gray-700 dark:text-gray-300">
                        {deleteTarget?.type === 'template'
                            ? "¿Está seguro de eliminar esta plantilla de forma permanente?"
                            : "¿Está seguro de eliminar esta receta? Esta acción no se puede deshacer."}
                    </p>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="danger" onClick={confirmDelete}>Eliminar</Button>
                    </div>
                </div>
            </Modal>

            {/* --- SPLIT / CONFLICT RESOLUTION MODAL --- */}
            <Modal isOpen={!!splitConflict} onClose={() => setSplitConflict(null)} title="⚠️ Receta en Progreso">
                <div className="space-y-4">
                    <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-100 dark:border-amber-800/50 flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-amber-800 dark:text-amber-200 font-bold text-sm">Cambios en receta parcialmente ejecutada</p>
                            <p className="text-amber-700 dark:text-amber-300 text-sm mt-1">
                                Esta receta ya fue aplicada en <strong>{splitConflict?.executedCount}</strong> lotes.
                                Modificarla ahora cambiaría el historial de lo que ya se hizo.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 pt-2">
                        {/* Option 1: Split (Recommended) */}
                        <button
                            onClick={handleSplitConfirm}
                            className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 border-2 border-green-500/50 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-left group"
                        >
                            <div className="bg-green-100 dark:bg-green-900/50 p-2 rounded-lg text-green-600 dark:text-green-400">
                                <Split className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="font-bold text-gray-800 dark:text-white block group-hover:text-green-700 dark:group-hover:text-green-400">Aplicar solo a Pendientes (Recomendado)</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                                    Crea una <strong>nueva receta</strong> con tus cambios para los {splitConflict?.pendingCount} lotes restantes.
                                    La receta vieja queda guardada tal cual se ejecutó.
                                </span>
                            </div>
                        </button>

                        {/* Option 2: Overwrite */}
                        <button
                            onClick={handleOverwriteConfirm}
                            className="flex items-start gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-left group"
                        >
                            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-lg text-gray-500 dark:text-gray-400">
                                <Copy className="w-6 h-6" />
                            </div>
                            <div>
                                <span className="font-bold text-gray-800 dark:text-white block">Sobrescribir Todo (Corregir)</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mt-1">
                                    Modifica la receta original. Úsalo solo si te equivocaste al escribirla.
                                    <strong>Alterará el registro histórico.</strong>
                                </span>
                            </div>
                        </button>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button variant="ghost" onClick={() => setSplitConflict(null)}>Cancelar</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};