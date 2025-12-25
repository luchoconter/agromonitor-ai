
import * as XLSX from 'xlsx';
import { collection, query, where, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { MonitoringRecord, Pest, Crop, Season, Company, Field, Plot } from '../types/models';
import { User } from '../types/auth';

interface ImportResult {
    total: number;
    success: number;
    errors: number;
    created: {
        companies: number;
        fields: number;
        plots: number;
        pests: number;
        users: number;
    };
}

// Helper to remove undefined fields which Firestore does not support
const cleanObject = (obj: any): any => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) {
            delete newObj[key];
        } else if (newObj[key] !== null && typeof newObj[key] === 'object' && !Array.isArray(newObj[key])) {
            newObj[key] = cleanObject(newObj[key]);
        }
    });
    return newObj;
};

export const processExcelMonitoringImport = async (
    file: File, 
    ownerId: string, 
    ownerName: string
): Promise<ImportResult> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 'A' }) as any[];

    const result: ImportResult = {
        total: 0,
        success: 0,
        errors: 0,
        created: { companies: 0, fields: 0, plots: 0, pests: 0, users: 0 }
    };

    // Skip header (Row 1)
    const dataRows = rows.slice(1);
    result.total = dataRows.length;

    // Local caches to avoid redundant DB calls during the loop
    const cache = {
        companies: new Map<string, string>(),
        fields: new Map<string, string>(),
        plots: new Map<string, string>(),
        seasons: new Map<string, string>(),
        crops: new Map<string, string>(),
        users: new Map<string, string>(),
        pests: new Map<string, string>(),
        assignments: new Map<string, string>()
    };

    const findOrCreate = async (coll: string, name: string, parentField?: string, parentId?: string) => {
        const cacheKey = `${parentId || 'root'}_${name.toLowerCase()}`;
        if (cache[coll as keyof typeof cache].has(cacheKey)) {
            return cache[coll as keyof typeof cache].get(cacheKey)!;
        }

        let q = query(collection(db, coll), where('ownerId', '==', ownerId), where('name', '==', name));
        if (parentField && parentId) {
            q = query(collection(db, coll), where('ownerId', '==', ownerId), where('name', '==', name), where(parentField, '==', parentId));
        }

        const snap = await getDocs(q);
        if (!snap.empty) {
            const id = snap.docs[0].id;
            cache[coll as keyof typeof cache].set(cacheKey, id);
            return id;
        }

        // Create new
        const payload: any = { name, ownerId, ownerName };
        if (parentField && parentId) payload[parentField] = parentId;
        
        // Specific extras
        if (coll === 'seasons') payload.isActive = false;
        if (coll === 'plots') payload.hectares = 0; 

        const newDoc = await addDoc(collection(db, coll), payload);
        result.created[coll as keyof typeof result.created]++;
        cache[coll as keyof typeof cache].set(cacheKey, newDoc.id);
        return newDoc.id;
    };

    const findOrCreateAssignment = async (plotId: string, seasonId: string, cropId: string) => {
        const cacheKey = `${plotId}_${seasonId}`;
        if (cache.assignments.has(cacheKey)) return;

        const q = query(collection(db, 'assignments'), 
            where('plotId', '==', plotId), 
            where('seasonId', '==', seasonId)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
            await addDoc(collection(db, 'assignments'), {
                plotId,
                seasonId,
                cropId,
                ownerId,
                ownerName
            });
        } else {
            // Update if different crop
            const existing = snap.docs[0];
            if (existing.data().cropId !== cropId) {
                await updateDoc(existing.ref, { cropId });
            }
        }
        cache.assignments.set(cacheKey, 'exists');
    };

    const findOrCreateUser = async (emailOrName: string) => {
        const key = emailOrName.toLowerCase();
        if (cache.users.has(key)) return cache.users.get(key)!;

        // SPECIFIC RULE: If it's the engineer's email, don't create a new operator
        // Use the current ownerId instead.
        if (key === 'enriqueamarcon@gmail.com') {
            cache.users.set(key, ownerId);
            return ownerId;
        }

        const q = query(collection(db, 'users'), where('email', '==', emailOrName));
        const snap = await getDocs(q);
        if (!snap.empty) {
            const id = snap.docs[0].id;
            cache.users.set(key, id);
            return id;
        }

        const newUser = {
            name: emailOrName.split('@')[0],
            email: emailOrName,
            password: '11111111',
            role: 'operator',
            status: 'active',
            linkedAdminId: ownerId,
            consultancyName: ownerName
        };
        const docRef = await addDoc(collection(db, 'users'), newUser);
        result.created.users++;
        cache.users.set(key, docRef.id);
        return docRef.id;
    };

    for (const row of dataRows) {
        try {
            const rowLote = String(row['A'] || '').trim();
            const rowCultivo = String(row['B'] || '').trim();
            const rowFechaRaw = row['C'];
            const rowCoordsRaw = String(row['D'] || '').trim();
            const rowObs = String(row['E'] || '').trim();
            const rowResp = String(row['L'] || 'Ingeniero').trim();
            const rowEmpresa = String(row['M'] || 'Desconocida').trim();
            const rowCampo = String(row['N'] || 'Desconocido').trim();
            const rowCampaña = String(row['O'] || '2025/26').trim();

            if (!rowLote || !rowEmpresa) continue;

            const companyId = await findOrCreate('companies', rowEmpresa);
            const fieldId = await findOrCreate('fields', rowCampo, 'companyId', companyId);
            const plotId = await findOrCreate('plots', rowLote, 'fieldId', fieldId);
            const seasonId = await findOrCreate('seasons', rowCampaña);
            const userId = await findOrCreateUser(rowResp);

            // Handle Crop & Assignment
            if (rowCultivo) {
                const cropId = await findOrCreate('crops', rowCultivo);
                await findOrCreateAssignment(plotId, seasonId, cropId);
            }

            let finalDate = new Date().toISOString();
            if (rowFechaRaw) {
                if (typeof rowFechaRaw === 'number') {
                    const date = new Date((rowFechaRaw - 25569) * 86400 * 1000);
                    finalDate = date.toISOString();
                } else {
                    const parts = String(rowFechaRaw).split('/');
                    if (parts.length === 3) {
                        const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                        finalDate = date.toISOString();
                    }
                }
            }

            let location = null;
            if (rowCoordsRaw.includes(',')) {
                const [lat, lng] = rowCoordsRaw.split(',').map(v => parseFloat(v.trim()));
                if (!isNaN(lat) && !isNaN(lng)) {
                    location = { lat, lng, accuracy: 10 };
                }
            }

            const pestData = [];
            const mapPest = async (pName: string, pUnit: string, pVal: any) => {
                if (!pName) return null;
                const pestId = await findOrCreate('pests', pName);
                let value = pVal ?? '';
                let unit = pUnit ?? 'Nivel';
                if (!pVal || pVal === '') {
                    value = pUnit ?? 'Nivel'; 
                    unit = 'Nivel';
                }
                return { pestId, name: pName, value, unit };
            };

            const p1 = await mapPest(row['F'], row['G'], row['H']);
            if (p1) pestData.push(p1);
            const p2 = await mapPest(row['I'], row['J'], row['K']);
            if (p2) pestData.push(p2);

            const monitoring: Omit<MonitoringRecord, 'id'> = {
                companyId,
                fieldId,
                plotId,
                seasonId,
                userId,
                userName: rowResp.toLowerCase() === 'enriqueamarcon@gmail.com' ? ownerName : rowResp.split('@')[0],
                ownerId,
                ownerName,
                sampleNumber: 1,
                date: finalDate,
                location,
                observations: rowObs,
                pestData,
                severity: 'baja'
            };

            // Clean any potential undefined values before saving to Firestore
            const cleanMonitoring = cleanObject(monitoring);

            await addDoc(collection(db, 'monitorings'), cleanMonitoring);
            result.success++;

        } catch (e) {
            console.error("Error importing row:", row, e);
            result.errors++;
        }
    }

    return result;
};
