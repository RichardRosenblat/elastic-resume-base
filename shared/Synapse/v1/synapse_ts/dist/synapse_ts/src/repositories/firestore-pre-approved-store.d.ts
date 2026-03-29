import type { IPreApprovedStore, PreApprovedDocument, CreatePreApprovedData, UpdatePreApprovedData, PreApprovedFilters } from '../interfaces/pre-approved-store.js';
/**
 * Concrete {@link IPreApprovedStore} implementation backed by Firestore.
 * Uses the lowercased email address as the document ID.
 */
export declare class FirestorePreApprovedStore implements IPreApprovedStore {
    private readonly _collectionName;
    constructor(collectionName: string);
    private get _collection();
    add(data: CreatePreApprovedData): Promise<PreApprovedDocument>;
    getByEmail(email: string): Promise<PreApprovedDocument | null>;
    update(email: string, data: UpdatePreApprovedData): Promise<PreApprovedDocument>;
    delete(email: string): Promise<void>;
    list(filters?: PreApprovedFilters): Promise<PreApprovedDocument[]>;
}
//# sourceMappingURL=firestore-pre-approved-store.d.ts.map